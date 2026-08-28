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
import type { NodeExecutionInstance } from './node-executor-instance.ts';
import type { NodeExecutionOutcome } from './node-executor-outcome.ts';

type AgentStepNodeConfig = Extract<ExecutableNodeConfig, { readonly type: 'agent_step' }>;

/**
 * Az `agent_step` node bemenete (SPEC-004 5. szekció 2. sora, 5.2 szekció).
 * A `descriptor` a **feloldott** provider leíró, amit a hívó
 * (`run-supervisor`, T-005-25) a `providerDescriptorLookup` porton és a
 * háromszintű feloldáson (11.1) keresztül már megkapott - ez a téma nem keres
 * leírót. A `graph`, a `sessionSourceNodes` és a `sessionInstances` a session
 * kötés feloldásának bemenetei (6.3, 6.4), amiket a `runAgentStep` fogyaszt.
 */
export interface ExecuteAgentStepInput {
  readonly instance: NodeExecutionInstance;
  readonly config: AgentStepNodeConfig;
  readonly descriptor: ProviderCapabilityDescriptor<string, string>;
  readonly runContext: RunContext;
  readonly graph: ExecutableGraph;
  readonly sessionSourceNodes: SessionSourceNodes;
  readonly sessionInstances: readonly SessionBearingInstance[];
}

/**
 * Az `agent_step` node végrehajtója: a SPEC-004 5.2 teljes tíz pontja, a
 * `agent-node-lifecycle` közös menetén át. A hely kérése és felszabadítása
 * ebben a rétegben történik (7.1, 7.2 - `agent_step` foglal helyet, mert
 * provider hívást indít), a tényleges futtatás a `runAgentStep` (`agent-step`
 * téma) dolga. A lépés csak akkor megy `succeeded` állapotba, ha a `result`
 * `subtype` értéke `success`, és - ha a lépés strukturált kimenetet vár - az
 * ténylegesen megérkezett (5.2 9. pont, `runAgentStep` `classifyResult`
 * függvénye).
 */
export function executeAgentStep(
  input: ExecuteAgentStepInput,
  ports: EngineDependencies,
  gate: ConcurrencyGate,
): Promise<Outcome<NodeExecutionOutcome>> {
  return runAgentNodeLifecycle(
    {
      instance: input.instance,
      nodeType: 'agent_step',
      config: input.config,
      descriptor: input.descriptor,
      runContext: input.runContext,
      graph: input.graph,
      sessionSourceNodes: input.sessionSourceNodes,
      sessionInstances: input.sessionInstances,
    },
    ports,
    gate,
  );
}
