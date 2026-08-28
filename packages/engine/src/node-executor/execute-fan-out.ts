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

type FanOutNodeConfig = Extract<ExecutableNodeConfig, { readonly type: 'fan_out' }>;

export interface ExecuteFanOutInput {
  readonly instance: NodeExecutionInstance;
  readonly config: FanOutNodeConfig;
  readonly runContext: RunContext;
}

function failFanOut(
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
 * Minden elemre lerenderli a `branchLabelTemplate`-et, és csak azt
 * ellenőrzi, hogy a renderelés sikerül-e (SPEC-004 5. szekció 4. sora,
 * "döntsd el és dokumentáld, mire használod az eredményt, ha a séma nem
 * tárolja"). **A séma nem tárolja a renderelt címkéket**: sem a
 * `FanOutExpandedPayload` (csak `itemCount`), sem a `step_run` tábla nem
 * hordoz erre oszlopot, tehát a renderelt szöveg eldobódik - ez tudatos
 * döntés, nem hiányosság: a `templateRenderer.compile` már a futás indítási
 * validáció szakaszában (jövőbeli lépés) ellenőrizhetné a sablon szintaxist,
 * ez a téma csak az elemenkénti renderelés sikerét kényszeríti ki.
 */
function renderItemLabels(
  template: string,
  items: readonly unknown[],
  runContext: RunContext,
  ports: NodeExecutorPorts,
): Outcome<void> {
  for (const [itemIndex, item] of items.entries()) {
    const rendered = ports.templateRenderer.render(template, { ...runContext, item, itemIndex });
    if (rendered.kind === 'error') {
      return rendered;
    }
  }
  return { kind: 'ok', value: undefined };
}

/**
 * A `fan_out` node végrehajtója (SPEC-004 5. szekció 4. sora, 4.5 szekció).
 * Kiértékeli az `itemsExpression`-t, listára szűkíti, minden elemre
 * lerenderli a `branchLabelTemplate`-et, majd `fan_out_expanded` eseményt ír.
 * **N = 0 nem hiba** (4.5 szekció): üres tömb esetén nincs mit renderelni, a
 * kimenet üres lista. A node kimenete a kiértékelt elemlista - ez az egyetlen
 * a négy közül (`start`, `branch`, `fan_out`, `loop`), aminek van valódi,
 * adatot hordozó kimenete a `join merge`-n kívül, mert a lista maga a
 * kibontás eredménye, nem csak egy vezérlési döntés.
 */
export function executeFanOut(input: ExecuteFanOutInput, ports: NodeExecutorPorts): Outcome<NodeExecutionOutcome> {
  const { instance, config, runContext } = input;
  const nodeId = instance.instance.nodeId;

  /* eslint-disable unicorn/no-null -- a `fan_out` node nem agent lépés, nincs modellje, session módja, strukturált kimenet stratégiája vagy al-workflow futása (SPEC-003 9.2) */
  const began = beginStepRun(
    {
      runId: instance.runId,
      nodeId,
      nodeType: 'fan_out',
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

  const evaluated = ports.expressionEvaluator.evaluate(config.itemsExpression, runContext);
  if (evaluated.kind === 'error') {
    const errorMessage = formatEngineErrorMessage(
      'expression_evaluation_failed',
      `A(z) "${nodeId}" fan_out node "${config.itemsExpression}" kifejezésének kiértékelése sikertelen: ${evaluated.message}`,
    );
    return failFanOut(runId, stepRunId, startedAtMs, 'expression_evaluation_failed', errorMessage, ports);
  }

  if (!Array.isArray(evaluated.value)) {
    const errorMessage = formatEngineErrorMessage(
      'fan_out_items_not_a_list',
      `A(z) "${nodeId}" fan_out node "${config.itemsExpression}" kifejezésének eredménye nem lista`,
    );
    return failFanOut(runId, stepRunId, startedAtMs, 'fan_out_items_not_a_list', errorMessage, ports);
  }
  const items: readonly unknown[] = evaluated.value;

  const rendered = renderItemLabels(config.branchLabelTemplate, items, runContext, ports);
  if (rendered.kind === 'error') {
    const errorMessage = formatEngineErrorMessage(
      'template_render_failed',
      `A(z) "${nodeId}" fan_out node "${config.branchLabelTemplate}" címke sablonjának renderelése sikertelen: ${rendered.message}`,
    );
    return failFanOut(runId, stepRunId, startedAtMs, 'template_render_failed', errorMessage, ports);
  }

  const finished = finishStepRunSucceeded({ runId, stepRunId, startedAtMs, output: items }, ports);
  if (finished.kind === 'error') {
    return finished;
  }

  const emitted = emitEngineEvent(
    { kind: 'fan_out_expanded', runId, stepRunId, payload: { itemCount: items.length } },
    ports,
  );
  if (emitted.kind === 'error') {
    return emitted;
  }

  return { kind: 'ok', value: { kind: 'fan_out_expanded', stepRun: finished.value, items } };
}
