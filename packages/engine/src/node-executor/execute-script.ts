import type { ScriptConfig } from '@easter-workflow-builder/db';
import type { Outcome } from '@easter-workflow-builder/core';
import type { EngineDependencies } from '../engine-port/engine-dependencies.ts';
import type { EngineErrorKind } from '../engine-error/engine-error-kind.ts';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';
import type { RunContext } from '../run-context/run-context.ts';
import { beginStepRun } from './begin-step-run.ts';
import { finishStepRunFailed } from './finish-step-run-failed.ts';
import { finishStepRunWithOutput } from './finish-step-run-with-output.ts';
import type { NodeExecutionInstance } from './node-executor-instance.ts';
import type { NodeExecutionResult } from './node-executor-result.ts';
import type { NodeExecutorPorts } from './node-executor-ports.ts';

/**
 * A szkript lépés bemenete (SPEC-014 5.5, 5.8), a `script` node és a `join`
 * `script` módja közösen:
 *
 * - `nodeType`: a `step_run` sor node típusa (`script` vagy `join`).
 * - `script`: a `ScriptConfig` (a `script` node maga, a `join` `settings`
 *   mezője); a `runtime` dönti el a futtatót.
 * - `runContext`: a SPEC-010 7.3 leképezés, ugyanaz, amit a `branch` kifejezése
 *   kap (`build-run-context.ts`); a `join` `script` módjában a `joinInputs` a
 *   `merge` móddal azonos lista, a `script` node-nál a név hiányzik.
 * - `stopSignal`: a futás leállításának jele (megszakítás, szabályos leállás,
 *   `fail_run`); a JavaScript futtató ezen áll meg (SPEC-014 5.8).
 */
export interface ExecuteScriptInput {
  readonly instance: NodeExecutionInstance;
  readonly nodeType: 'script' | 'join';
  readonly script: ScriptConfig;
  readonly runContext: RunContext;
  readonly stopSignal: AbortSignal;
}

/**
 * A futtatás eredménye a lépés lezárása előtt: a kimenet, a hiba (a motor
 * mondatával, a hibaosztállyal a végén), vagy a külső jel megszakítása.
 */
type ScriptEvaluation =
  | { readonly kind: 'succeeded'; readonly output: unknown }
  | { readonly kind: 'failed'; readonly errorKind: EngineErrorKind; readonly errorMessage: string }
  | { readonly kind: 'aborted' };

type ScriptPorts = Pick<EngineDependencies, keyof NodeExecutorPorts | 'scriptRunner'>;

function failure(errorKind: EngineErrorKind, nodeId: string, detail: string): ScriptEvaluation {
  return {
    kind: 'failed',
    errorKind,
    errorMessage: formatEngineErrorMessage(
      errorKind,
      `A(z) "${nodeId}" node szkriptjének futása sikertelen: ${detail}`,
    ),
  };
}

/**
 * A két futtató közti választás, kimerítő `switch` a `runtime` mezőn
 * (SPEC-014 5.2, 5.8): a CEL ág a meglévő `expressionEvaluator` porton fut
 * (az eredményt a port a SPEC-010 7.4 szerint normalizálja), a JavaScript ág a
 * `scriptRunner` porton, a tárolt `timeoutMs`, `cwd`, `memoryLimitMb`,
 * `fetchResponseLimitMb` és `fileReadLimitMb` mezővel (a `null` alapértéket a
 * futtató oldja fel).
 */
async function evaluateScript(input: ExecuteScriptInput, ports: ScriptPorts): Promise<ScriptEvaluation> {
  const { script, runContext } = input;
  const nodeId = input.instance.instance.nodeId;
  switch (script.runtime) {
    case 'expression': {
      const evaluated = ports.expressionEvaluator.evaluate(script.source, runContext);
      if (evaluated.kind === 'error') {
        return failure('expression_evaluation_failed', nodeId, evaluated.message);
      }
      return { kind: 'succeeded', output: evaluated.value };
    }
    case 'javascript': {
      const result = await ports.scriptRunner.run({
        source: script.source,
        runContext,
        timeoutMs: script.timeoutMs,
        cwd: script.cwd,
        memoryLimitMb: script.memoryLimitMb,
        fetchResponseLimitMb: script.fetchResponseLimitMb,
        fileReadLimitMb: script.fileReadLimitMb,
        signal: input.stopSignal,
      });
      if (result.kind === 'failed') {
        return failure(result.errorKind, nodeId, result.message);
      }
      return result;
    }
  }
}

/**
 * A szkript lépés közös végrehajtója (SPEC-014 5.5 ... 5.8): a diszpécser
 * `script` ága és a `join` `script` módja hívja. A menet a közös nyitás
 * (`beginStepRun`), a futtatás, majd a lezárás:
 *
 * - siker: a kimenet a közös tárolási korláttal (`finishStepRunWithOutput`,
 *   `step_output_not_storable`), a vezérlés minden nem `on_error` kimenő élen
 *   megy tovább (`selectedBranchKey: null`);
 * - hiba: a lépés `failed`, a CEL ágon `expression_evaluation_failed`, a
 *   JavaScript ágon a futtató három osztályának egyike (5.7), a `handledErrorKinds`
 *   szűrő név szerint kezelheti őket;
 * - megszakítás: a futtató `aborted` eredménye után `interrupted`, sor írás
 *   nélkül; a `running` sort a leállítást kérő fél zárja `cancelled` (illetve a
 *   szabályos leállásnál `interrupted`) állapotba, ugyanúgy, mint a backoffra
 *   váró `error_handler` sorát (`advance-run.ts` `cancelStoppedStepRuns`).
 *
 * **A lépés nem foglal párhuzamossági helyet** (nincs provider hívás, SPEC-004
 * 7.2), ezért a szabályozót nem kapja meg.
 */
export async function executeScript(
  input: ExecuteScriptInput,
  ports: ScriptPorts,
): Promise<Outcome<NodeExecutionResult>> {
  const { instance } = input;
  const nodeId = instance.instance.nodeId;

  /* eslint-disable unicorn/no-null -- a szkript lépés nem agent lépés, nincs modellje, session módja, strukturált kimenet stratégiája vagy al-workflow futása (SPEC-003 9.2) */
  const began = beginStepRun(
    {
      runId: instance.runId,
      nodeId,
      nodeType: input.nodeType,
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

  const evaluation = await evaluateScript(input, ports);
  switch (evaluation.kind) {
    case 'aborted': {
      return { kind: 'ok', value: { kind: 'interrupted' } };
    }
    case 'failed': {
      const { errorKind, errorMessage } = evaluation;
      const failed = finishStepRunFailed({ runId, stepRunId, startedAtMs, errorKind, errorMessage }, ports);
      if (failed.kind === 'error') {
        return failed;
      }
      return { kind: 'ok', value: { kind: 'failed', stepRun: failed.value, errorKind, errorMessage } };
    }
    case 'succeeded': {
      const finished = finishStepRunWithOutput(
        { nodeId, runId, stepRunId, startedAtMs, output: evaluation.output },
        ports,
      );
      if (finished.kind === 'error') {
        return finished;
      }
      if (finished.value.kind === 'failed') {
        return { kind: 'ok', value: finished.value };
      }
      // eslint-disable-next-line unicorn/no-null -- a `NodeExecutionOutcome.selectedBranchKey` `null` értéke a "minden nem `on_error` kimenő él live" jelentés (node-executor-outcome.ts)
      return { kind: 'ok', value: { kind: 'succeeded', stepRun: finished.value.stepRun, selectedBranchKey: null } };
    }
  }
}
