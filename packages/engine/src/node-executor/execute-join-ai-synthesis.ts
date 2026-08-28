import type { ProviderCapabilityDescriptor } from '@easter-workflow-builder/provider-capability';
import type { Outcome } from '@easter-workflow-builder/core';
import type { SessionBearingInstance } from '../agent-step/session-bearing-instance.ts';
import type { SessionSourceNodes } from '../agent-step/session-source-nodes.ts';
import type { ConcurrencyGate } from '../concurrency-gate/concurrency-gate.ts';
import type { EngineDependencies } from '../engine-port/engine-dependencies.ts';
import type { ExecutableGraph } from '../run-graph/executable-graph.ts';
import type { RunContext } from '../run-context/run-context.ts';
import type { ExecutableNodeConfig } from '../run-validation/executable-node-config.ts';
import { runAgentNodeLifecycle } from './agent-node-lifecycle.ts';
import { emitEngineEvent } from './emit-engine-event.ts';
import type { NodeExecutionInstance } from './node-executor-instance.ts';
import type { NodeExecutionOutcome } from './node-executor-outcome.ts';

type JoinAiSynthesisNodeConfig = Extract<
  ExecutableNodeConfig,
  { readonly type: 'join'; readonly mode: 'ai_synthesis' }
>;

/**
 * A `join` node `ai_synthesis` módjának bemenete (SPEC-004 5. szekció 5.
 * sora, 5.6 szekció). A `config.settings` a `JoinAiSynthesisNodeConfig`
 * `AgentStepConfig` alobjektuma - a végrehajtás ugyanaz az 5.2 életciklus,
 * mint az `agent_step` node-nál, ezért ez a téma nem ismétli meg a menetet,
 * csak átadja a `runAgentNodeLifecycle` közös függvénynek.
 *
 * A `runContext`-et a hívó (`run-supervisor`, T-005-25) úgy állítja össze
 * (`buildRunContext` `joinInputs` paraméterével), hogy a `joinInputs` mező már
 * ki legyen töltve a beérkezett ág kimenetekkel - ez a téma a kontextust
 * **kapja**, nem építi. A `joinInputs` emellett **külön mezőként is** a
 * bemenet része, ugyanúgy, mint az `execute-join-merge.ts`-ben: a
 * `join_resolved` esemény `inputCount` mezője ebből számol, és így nem kell a
 * `RunContext.joinInputs` opcionális (`| undefined`) mezőjét egy garantáltan
 * sosem futó ág nélkül kiolvasni (`.claude/CLAUDE.md` 5. szekció "100
 * százalékos lefedettség").
 */
export interface ExecuteJoinAiSynthesisInput {
  readonly instance: NodeExecutionInstance;
  readonly config: JoinAiSynthesisNodeConfig;
  readonly descriptor: ProviderCapabilityDescriptor<string, string>;
  readonly runContext: RunContext;
  readonly graph: ExecutableGraph;
  readonly sessionSourceNodes: SessionSourceNodes;
  readonly sessionInstances: readonly SessionBearingInstance[];
  readonly joinInputs: readonly unknown[];
}

/**
 * A `join` node `ai_synthesis` módjának végrehajtója: teljes `agent_step`
 * életciklus (`runAgentNodeLifecycle`), a záráskor pedig a `step_finished`
 * esemény **mellett** egy `join_resolved` esemény is íródik, `mode:
 * 'ai_synthesis'` és a bemenetek darabszámával (SPEC-004 5. szekció 5. sora:
 * "`join_resolved` esemény"). A `join_resolved` a lezárás módjától
 * függetlenül, sikeres és hibás záráskor is kiadásra kerül, mert a join
 * vezérlési szemantikáját (hány ág futott be) jelzi, nem az agent lépés saját
 * sikerét - lásd `packages/engine/CLAUDE.md`.
 */
export async function executeJoinAiSynthesis(
  input: ExecuteJoinAiSynthesisInput,
  ports: EngineDependencies,
  gate: ConcurrencyGate,
): Promise<Outcome<NodeExecutionOutcome>> {
  const outcome = await runAgentNodeLifecycle(
    {
      instance: input.instance,
      nodeType: 'join',
      config: input.config.settings,
      descriptor: input.descriptor,
      runContext: input.runContext,
      graph: input.graph,
      sessionSourceNodes: input.sessionSourceNodes,
      sessionInstances: input.sessionInstances,
    },
    ports,
    gate,
  );
  if (outcome.kind === 'error') {
    return outcome;
  }

  const { stepRun } = outcome.value;
  const emitted = emitEngineEvent(
    {
      kind: 'join_resolved',
      runId: stepRun.runId,
      stepRunId: stepRun.id,
      payload: { mode: 'ai_synthesis', inputCount: input.joinInputs.length },
    },
    ports,
  );
  if (emitted.kind === 'error') {
    return emitted;
  }

  return outcome;
}
