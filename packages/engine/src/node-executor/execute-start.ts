import type { Outcome } from '@easter-workflow-builder/core';
import { beginStepRun } from './begin-step-run.ts';
import { finishStepRunSucceeded } from './finish-step-run-succeeded.ts';
import type { NodeExecutionInstance } from './node-executor-instance.ts';
import type { NodeExecutionOutcome } from './node-executor-outcome.ts';
import type { NodeExecutorPorts } from './node-executor-ports.ts';

/**
 * A `start` node bemenete (SPEC-004 5. szekció 1. sora): a futás bemenetének
 * ellenőrzése a `4.8` 4. pontjában, a futás létrehozása **előtt** megtörtént
 * (`missing_required_input`), ez a téma nem ismétli meg.
 */
export interface ExecuteStartInput {
  readonly instance: NodeExecutionInstance;
  readonly input: unknown;
}

/**
 * A `start` node végrehajtója: azonnal `succeeded`, a kimenete maga a
 * bemenet, és nincs saját hibaága (SPEC-004 5. szekció 1. sora). Nincs
 * kimenő él választás sem - a `selectedBranchKey: null` azt jelenti a
 * hívónak, hogy minden `on_error`-tól különböző kimenő él `live` jelölést kap
 * (`node-executor-outcome.ts` dokumentációja).
 */
export function executeStart(input: ExecuteStartInput, ports: NodeExecutorPorts): Outcome<NodeExecutionOutcome> {
  const { instance } = input;

  /* eslint-disable unicorn/no-null -- a `CreateStepRunInput` nullázható mezői (SPEC-003 9.2) a hívó felelőssége; a `start` node nem agent lépés, nincs modellje, session módja, strukturált kimenet stratégiája vagy al-workflow futása */
  const began = beginStepRun(
    {
      runId: instance.runId,
      nodeId: instance.instance.nodeId,
      nodeType: 'start',
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

  const finished = finishStepRunSucceeded(
    {
      runId: instance.runId,
      stepRunId: began.value.stepRun.id,
      startedAtMs: began.value.startedAtMs,
      output: input.input,
    },
    ports,
  );
  if (finished.kind === 'error') {
    return finished;
  }

  // eslint-disable-next-line unicorn/no-null -- a `NodeExecutionOutcome.selectedBranchKey` `null` értéke a "minden nem `on_error` kimenő él live" jelentés (node-executor-outcome.ts)
  return { kind: 'ok', value: { kind: 'succeeded', stepRun: finished.value, selectedBranchKey: null } };
}
