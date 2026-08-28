import { isBoolean } from '@easter-workflow-builder/typeguards';
import type { Outcome } from '@easter-workflow-builder/core';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';
import type { EngineErrorKind } from '../engine-error/engine-error-kind.ts';
import type { RunContext } from '../run-context/run-context.ts';
import type { ExecutableNodeConfig } from '../run-validation/executable-node-config.ts';
import { beginStepRun } from './begin-step-run.ts';
import { emitEngineEvent } from './emit-engine-event.ts';
import { finishStepRunFailed } from './finish-step-run-failed.ts';
import { finishStepRunSucceeded } from './finish-step-run-succeeded.ts';
import type { NodeExecutionInstance } from './node-executor-instance.ts';
import type { NodeExecutionOutcome } from './node-executor-outcome.ts';
import type { NodeExecutorPorts } from './node-executor-ports.ts';

type LoopNodeConfig = Extract<ExecutableNodeConfig, { readonly type: 'loop' }>;

/**
 * A `loop` node bemenete (SPEC-004 5. szekció 6. sora, 4.6 szekció). Az
 * `instance.iteration` mező itt **nem** az általános 4.3 szabály szerinti
 * érték (a legfelső `loop` hatókör bejegyzés száma), hanem a 4.6 1. pontja
 * szerinti, node típusra szűkített jelentés: "a példány addigi lefutásainak
 * a száma, nullától indulva". Ezt a hívó (`run-supervisor`, T-005-25) a
 * `scheduling` téma `resolveLoopIteration` függvényéből számolja, és a
 * `step_run.iteration` oszlop mindkét jelentésre ugyanazt az oszlopot
 * használja (SPEC-003 4.10) - ez a téma nem dönti el, melyik jelentés
 * érvényes, csak felhasználja azt, amit kap.
 */
export interface ExecuteLoopInput {
  readonly instance: NodeExecutionInstance;
  readonly config: LoopNodeConfig;
  readonly runContext: RunContext;
}

function failLoop(
  runId: string,
  stepRunId: string,
  startedAtMs: number,
  errorKind: EngineErrorKind,
  errorMessage: string,
  ports: NodeExecutorPorts,
): Outcome<NodeExecutionOutcome> {
  const failed = finishStepRunFailed({ runId, stepRunId, startedAtMs, errorKind, errorMessage }, ports);
  if (failed.kind === 'error') {
    return failed;
  }
  return { kind: 'ok', value: { kind: 'failed', stepRun: failed.value, errorKind, errorMessage } };
}

/**
 * A `loop` node végrehajtója (SPEC-004 5. szekció 6. sora, 4.6 szekció).
 *
 * 1. Ha `iteration >= maxIterations`, a lépés `failed`
 *    `loop_max_iterations_reached` osztállyal zár, **kifejezés kiértékelés
 *    nélkül** (4.6 2. pont: a túllépés hiba, nem a `continueExpression`
 *    eredménye).
 * 2. Egyébként kiértékeli a `continueExpression`-t, logikai értékre
 *    szűkíti; nem logikai eredmény `expression_evaluation_failed`.
 * 3. A `loop_iteration_started` esemény **csak folytatás esetén** íródik
 *    (4.6 4. pont, SPEC-004 5.8 elve szerinti explicit "csak akkor" - itt a
 *    4.6 szó szerint mondja ki).
 *
 * A node kimenete erre a témára szűkítve `null`, ugyanazzal az indokkal, mint
 * a `branch` node esetén (`execute-branch.ts`): a `loop` sem transzformál
 * adatot, csak a folytatásról dönt - azt a `shouldContinue` mező hordozza a
 * kimenetben, a hívó itt is a `loop_advanced` `SchedulingEvent`-et építi
 * belőle (`node-executor-outcome.ts`).
 */
export function executeLoop(input: ExecuteLoopInput, ports: NodeExecutorPorts): Outcome<NodeExecutionOutcome> {
  const { instance, config, runContext } = input;
  const nodeId = instance.instance.nodeId;

  /* eslint-disable unicorn/no-null -- a `loop` node nem agent lépés, nincs modellje, session módja, strukturált kimenet stratégiája vagy al-workflow futása (SPEC-003 9.2) */
  const began = beginStepRun(
    {
      runId: instance.runId,
      nodeId,
      nodeType: 'loop',
      parentStepRunId: instance.parentStepRunId,
      iteration: instance.iteration,
      attempt: instance.attempt,
      providerId: instance.providerId,
      modelId: null,
      sessionMode: null,
      structuredOutputStrategy: null,
      subWorkflowRunId: null,
    },
    ports,
  );
  /* eslint-enable unicorn/no-null */
  if (began.kind === 'error') {
    return began;
  }
  const stepRunId = began.value.stepRun.id;
  const { runId } = instance;
  const { startedAtMs } = began.value;

  if (instance.iteration >= config.maxIterations) {
    const errorMessage = formatEngineErrorMessage(
      'loop_max_iterations_reached',
      `A(z) "${nodeId}" loop node elérte a beállított maximális iterációszámot (${String(config.maxIterations)})`,
    );
    return failLoop(runId, stepRunId, startedAtMs, 'loop_max_iterations_reached', errorMessage, ports);
  }

  const evaluated = ports.expressionEvaluator.evaluate(config.continueExpression, runContext);
  if (evaluated.kind === 'error') {
    const errorMessage = formatEngineErrorMessage(
      'expression_evaluation_failed',
      `A(z) "${nodeId}" loop node "${config.continueExpression}" kifejezésének kiértékelése sikertelen: ${evaluated.message}`,
    );
    return failLoop(runId, stepRunId, startedAtMs, 'expression_evaluation_failed', errorMessage, ports);
  }
  if (!isBoolean(evaluated.value)) {
    const errorMessage = formatEngineErrorMessage(
      'expression_evaluation_failed',
      `A(z) "${nodeId}" loop node "${config.continueExpression}" kifejezésének eredménye nem logikai érték`,
    );
    return failLoop(runId, stepRunId, startedAtMs, 'expression_evaluation_failed', errorMessage, ports);
  }
  const shouldContinue = evaluated.value;

  /* eslint-disable-next-line unicorn/no-null -- a `loop` node kimenete szándékosan `null` (lásd a fájl doksiját); vezérlést hordoz, adatot nem */
  const finished = finishStepRunSucceeded({ runId, stepRunId, startedAtMs, output: null }, ports);
  if (finished.kind === 'error') {
    return finished;
  }

  if (shouldContinue) {
    const emitted = emitEngineEvent(
      {
        kind: 'loop_iteration_started',
        runId,
        stepRunId,
        payload: { iteration: instance.iteration, maxIterations: config.maxIterations },
      },
      ports,
    );
    if (emitted.kind === 'error') {
      return emitted;
    }
  }

  return { kind: 'ok', value: { kind: 'loop_advanced', stepRun: finished.value, shouldContinue } };
}
