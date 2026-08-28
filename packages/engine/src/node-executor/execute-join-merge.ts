import type { Outcome } from '@easter-workflow-builder/core';
import type { ExecutableNodeConfig } from '../run-validation/executable-node-config.ts';
import { beginStepRun } from './begin-step-run.ts';
import { emitEngineEvent } from './emit-engine-event.ts';
import { finishStepRunSucceeded } from './finish-step-run-succeeded.ts';
import type { NodeExecutionInstance } from './node-executor-instance.ts';
import type { NodeExecutionOutcome } from './node-executor-outcome.ts';
import type { NodeExecutorPorts } from './node-executor-ports.ts';

type JoinMergeNodeConfig = Extract<ExecutableNodeConfig, { readonly type: 'join'; readonly mode: 'merge' }>;

/**
 * A `join` node `merge` módjának bemenete (SPEC-004 5. szekció 5. sora, 5.6
 * szekció). A `config.settings` üressége futás indításkor már ellenőrzött
 * (`validateJoinMergeSettings`, T-005-15, `unsupported_join_merge_setting`),
 * ez a téma nem ellenőrzi újra. A `joinInputs` a beérkezett ág kimenetek
 * listája, **elem sorrendben**: a hívó (`run-supervisor`) a `scheduling`
 * téma `collectJoinInputs`-ával gyűjti össze, ez a függvény készen kapja.
 */
export interface ExecuteJoinMergeInput {
  readonly instance: NodeExecutionInstance;
  readonly config: JoinMergeNodeConfig;
  readonly joinInputs: readonly unknown[];
}

/**
 * A `join` node `merge` módjának végrehajtója: a bemenetek listája
 * **változatlanul**, elem sorrendben - nem fűz össze szöveget, nem old fel
 * ütközést, nem szűr (5.6 szekció). Nincs saját hibaága. A `join_resolved`
 * esemény `mode: 'merge'` értékkel íródik.
 */
export function executeJoinMerge(
  input: ExecuteJoinMergeInput,
  ports: NodeExecutorPorts,
): Outcome<NodeExecutionOutcome> {
  const { instance, joinInputs } = input;
  const nodeId = instance.instance.nodeId;

  /* eslint-disable unicorn/no-null -- a `join` `merge` mód nem agent lépés, nincs modellje, session módja, strukturált kimenet stratégiája vagy al-workflow futása (SPEC-003 9.2) */
  const began = beginStepRun(
    {
      runId: instance.runId,
      nodeId,
      nodeType: 'join',
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

  const finished = finishStepRunSucceeded(
    { runId, stepRunId, startedAtMs: began.value.startedAtMs, output: joinInputs },
    ports,
  );
  if (finished.kind === 'error') {
    return finished;
  }

  const emitted = emitEngineEvent(
    { kind: 'join_resolved', runId, stepRunId, payload: { mode: 'merge', inputCount: joinInputs.length } },
    ports,
  );
  if (emitted.kind === 'error') {
    return emitted;
  }

  // eslint-disable-next-line unicorn/no-null -- a `NodeExecutionOutcome.selectedBranchKey` `null` értéke a "minden nem `on_error` kimenő él live" jelentés (node-executor-outcome.ts)
  return { kind: 'ok', value: { kind: 'succeeded', stepRun: finished.value, selectedBranchKey: null } };
}
