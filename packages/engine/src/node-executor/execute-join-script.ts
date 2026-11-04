import type { JoinScriptNodeConfig } from '@easter-workflow-builder/db';
import type { Outcome } from '@easter-workflow-builder/core';
import type { EngineDependencies } from '../engine-port/engine-dependencies.ts';
import type { RunContext } from '../run-context/run-context.ts';
import { emitEngineEvent } from './emit-engine-event.ts';
import { executeScript } from './execute-script.ts';
import type { NodeExecutionInstance } from './node-executor-instance.ts';
import type { NodeExecutionResult } from './node-executor-result.ts';
import type { NodeExecutorPorts } from './node-executor-ports.ts';

/**
 * A `join` node `script` módjának bemenete (SPEC-014 5.5). A `joinInputs` a
 * beérkezett ág kimenetek listája, elem sorrendben, ugyanaz, amit a `merge`
 * mód kimenetként ad (SPEC-004 5.6); a szkript a `runContext` `joinInputs`
 * nevén látja, ez a mező csak a `join_resolved` esemény darabszámához kell.
 */
export interface ExecuteJoinScriptInput {
  readonly instance: NodeExecutionInstance;
  readonly config: JoinScriptNodeConfig;
  readonly runContext: RunContext;
  readonly joinInputs: readonly unknown[];
  readonly stopSignal: AbortSignal;
}

/**
 * A `join` node `script` módjának végrehajtója: a közös szkript végrehajtó
 * (`executeScript`) a `settings` mezővel, a lezárás után `join_resolved`
 * eseménnyel (`mode: 'script'`). Az esemény a `ai_synthesis` mód mintájára a
 * lezárás módjától függetlenül, sikeres és hibás záráskor is íródik, mert a
 * join vezérlési szemantikáját jelzi (hány ág futott be); a megszakított lépés
 * nem zárult le, tehát ott nem íródik (`execute-join-ai-synthesis.ts`).
 */
export async function executeJoinScript(
  input: ExecuteJoinScriptInput,
  ports: Pick<EngineDependencies, keyof NodeExecutorPorts | 'scriptRunner'>,
): Promise<Outcome<NodeExecutionResult>> {
  const outcome = await executeScript(
    {
      instance: input.instance,
      nodeType: 'join',
      script: input.config.settings,
      runContext: input.runContext,
      stopSignal: input.stopSignal,
    },
    ports,
  );
  if (outcome.kind === 'error' || outcome.value.kind === 'interrupted') {
    return outcome;
  }

  const { stepRun } = outcome.value;
  const emitted = emitEngineEvent(
    {
      kind: 'join_resolved',
      runId: stepRun.runId,
      stepRunId: stepRun.id,
      payload: { mode: 'script', inputCount: input.joinInputs.length },
    },
    ports,
  );
  if (emitted.kind === 'error') {
    return emitted;
  }

  return outcome;
}
