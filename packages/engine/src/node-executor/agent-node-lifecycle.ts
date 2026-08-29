import type { AgentStepConfig, NodeType } from '@easter-workflow-builder/db';
import type { Outcome } from '@easter-workflow-builder/core';
import type { ProviderCapabilityDescriptor } from '@easter-workflow-builder/provider-capability';
import type { AgentStepCapabilityDecisions } from '../agent-step/agent-step-capability-decisions.ts';
import type { AgentStepExecution } from '../agent-step/agent-step-execution.ts';
import type { AgentStepRequest } from '../agent-step/agent-step-request.ts';
import type { SessionBearingInstance } from '../agent-step/session-bearing-instance.ts';
import type { SessionSourceNodes } from '../agent-step/session-source-nodes.ts';
import { runAgentStep } from '../agent-step/run-agent-step.ts';
import { validateAgentStepCapabilities } from '../agent-step/validate-agent-step-capabilities.ts';
import type { ConcurrencyGate } from '../concurrency-gate/concurrency-gate.ts';
import type { EngineDependencies } from '../engine-port/engine-dependencies.ts';
import type { EngineErrorKind } from '../engine-error/engine-error-kind.ts';
import type { StepStartedPayload } from '../engine-event/step-started-payload.ts';
import type { ExecutableGraph } from '../run-graph/executable-graph.ts';
import type { RunContext } from '../run-context/run-context.ts';
import type { AgentQueryRegistry } from '../run-interrupt/agent-query-registry.ts';
import { emitEngineEvent } from './emit-engine-event.ts';
import { finishStepRunFailed } from './finish-step-run-failed.ts';
import { finishStepRunSucceeded } from './finish-step-run-succeeded.ts';
import type { NodeExecutionInstance } from './node-executor-instance.ts';
import type { NodeExecutionOutcome } from './node-executor-outcome.ts';

/**
 * A `agent_step` és a `join` `ai_synthesis` módja közös élettartama (SPEC-004
 * 5.2, 5.6, 7.2), egyetlen belső függvénybe fogva, hogy a két vékony
 * végrehajtó (`execute-agent-step.ts`, `execute-join-ai-synthesis.ts`) ne
 * duplikálja a tíz pontos menetet. A `nodeType` az egyetlen tényleges
 * eltérés a `step_run.node_type` oszlop és a `step_started` payload
 * `nodeType` mezője szempontjából; a `join` node saját `join_resolved`
 * eseményét a hívó (`execute-join-ai-synthesis.ts`) adja hozzá, ez a
 * függvény nem ismer `join` specifikus eseményt.
 *
 * **A `ports` típusa szándékosan `EngineDependencies`, nem egy új,
 * `NodeExecutorPorts`-ból származtatott bővítés.** A `runAgentStep` (5.2 2 ...
 * 9. pont) a teljes kilenc portot várja, és egy `NodeExecutorPorts &
 * { agentQueryRunner, processEnvironment }` alakú bővítés a `runAgentStep`
 * hívásához úgyis fel kellene, hogy vegye a kilencedik, `providerDescriptorLookup`
 * mezőt is - ez a téma viszont nem keres leírót (a hívott már feloldva kapja),
 * tehát egy ilyen bővítés szó szerint ugyanazt a kilenc mezőt írná le, mint az
 * `EngineDependencies`, csak új néven. A meglévő típus újrahasználata a
 * "Minimum kód" elv szerint helyesebb, mint egy szerkezetileg azonos
 * duplikátum bevezetése (`.claude/CLAUDE.md` 5. szekció).
 */
export interface AgentNodeLifecycleInput {
  readonly instance: NodeExecutionInstance;
  readonly nodeType: NodeType;
  readonly config: AgentStepConfig;
  readonly descriptor: ProviderCapabilityDescriptor<string, string>;
  readonly runContext: RunContext;
  readonly graph: ExecutableGraph;
  readonly sessionSourceNodes: SessionSourceNodes;
  readonly sessionInstances: readonly SessionBearingInstance[];
}

/**
 * A `step_started` esemény három opcionális jelölője, kizárólag a ténylegesen
 * fennálló bizonytalanságokkal (`StepStartedPayload` doksija: "a mezők akkor
 * és csak akkor kerülnek a payloadba, ha az adott bizonytalanság ténylegesen
 * fennáll"). A `tsconfig` `exactOptionalPropertyTypes` kapcsolója miatt egy
 * `false` értéket **nem** szabad explicit kiírni, csak a mezőt elhagyni: innen
 * a feltételes szétterítés minden mezőn külön-külön.
 */
function stepStartedFlags(
  decisions: AgentStepCapabilityDecisions | undefined,
): Pick<StepStartedPayload, 'strategyUnproven' | 'modelIdentifierUnproven' | 'serverToolAvailabilityUnproven'> {
  if (decisions === undefined) {
    return {};
  }
  return {
    ...(decisions.structuredOutput?.strategyUnproven === true && { strategyUnproven: true as const }),
    ...(decisions.model.modelIdentifierUnproven && { modelIdentifierUnproven: true as const }),
    ...(decisions.disallowedServerTools.serverToolAvailabilityUnproven && {
      serverToolAvailabilityUnproven: true as const,
    }),
  };
}

/**
 * A közös záró hibaág: `finishStepRunFailed`, majd a `NodeExecutionOutcome`
 * `failed` ága. Az `execution` `undefined`, ha a hiba még a `runAgentStep`
 * hívása **előtt** derült ki (leíró szintű capability hiba, SPEC-004 11.3),
 * ilyenkor nincs token/`resultSubtype`/`numTurns` adat.
 */
function closeFailed(
  runId: string,
  stepRunId: string,
  startedAtMs: number,
  errorKind: EngineErrorKind,
  errorMessage: string,
  execution: AgentStepExecution | undefined,
  ports: EngineDependencies,
): Outcome<NodeExecutionOutcome> {
  const failed = finishStepRunFailed(
    {
      runId,
      stepRunId,
      startedAtMs,
      errorKind,
      errorMessage,
      ...(execution?.tokens !== undefined && { tokens: execution.tokens }),
      ...(execution?.resultSubtype !== undefined && { resultSubtype: execution.resultSubtype }),
      ...(execution?.numTurns !== undefined && { numTurns: execution.numTurns }),
    },
    ports,
  );
  if (failed.kind === 'error') {
    return failed;
  }
  return { kind: 'ok', value: { kind: 'failed', stepRun: failed.value, errorKind, errorMessage } };
}

/**
 * A lépés indulása és a tényleges futtatás a hely megszerzése **után**
 * (SPEC-004 5.2 1., 2 ... 9. pont): `markStepRunning`, `step_started`, a
 * leírótól függő döntések kudarca esetén azonnali zárás, egyébként
 * `runAgentStep` és a záró `markStepSucceeded`/`markStepFailed`. Ezt a
 * belső menetet a hívó **mindig** a hely birtokában futtatja, és **mindig**
 * `finally`-ban szabadítja fel utána (lásd `execute-agent-step.ts`,
 * `execute-join-ai-synthesis.ts`).
 */
async function runAfterSlotGranted(
  input: AgentNodeLifecycleInput,
  stepRunId: string,
  ports: EngineDependencies,
  agentQueryRegistry: AgentQueryRegistry,
): Promise<Outcome<NodeExecutionOutcome>> {
  const { instance, nodeType, config, descriptor, runContext, graph, sessionSourceNodes, sessionInstances } = input;
  const nodeId = instance.instance.nodeId;
  const { runId, providerId } = instance;

  const running = ports.database.stepRuns.markStepRunning(stepRunId);
  if (running.kind === 'error') {
    return running;
  }
  const startedAtMs = ports.clock.nowMs();

  // A leírótól függő döntések a spec 5.2 4. pontja szerint az `Options`
  // összeállításának bemenetei, DE a `step_started` esemény három jelölőjéhez
  // már itt, a `running` állapotba lépéskor kellenek (`AgentStepRequest`
  // doksija) - a függvény tiszta, ezért a kiszámítás bárhol megtehető, itt a
  // legelső olyan pont, ahol ténylegesen szükség van rá.
  const capabilities = validateAgentStepCapabilities(config, descriptor);

  const emitted = emitEngineEvent(
    {
      kind: 'step_started',
      runId,
      stepRunId,
      payload: {
        nodeId,
        nodeType,
        providerId,
        attempt: running.value.attempt,
        iteration: running.value.iteration,
        ...stepStartedFlags(capabilities.status === 'ok' ? capabilities.decisions : undefined),
      },
    },
    ports,
  );
  if (emitted.kind === 'error') {
    return emitted;
  }

  if (capabilities.status === 'failed') {
    return closeFailed(
      runId,
      stepRunId,
      startedAtMs,
      capabilities.errorKind,
      capabilities.errorMessage,
      undefined,
      ports,
    );
  }

  const request: AgentStepRequest = {
    runId,
    stepRunId,
    instance: instance.instance,
    config,
    decisions: capabilities.decisions,
    descriptor,
    runContext,
    graph,
    sessionSourceNodes,
    sessionInstances,
  };

  const executed = await runAgentStep(request, ports, agentQueryRegistry);
  if (executed.kind === 'error') {
    return executed;
  }
  const execution = executed.value;

  if (execution.outcome.status === 'failed') {
    return closeFailed(
      runId,
      stepRunId,
      startedAtMs,
      execution.outcome.errorKind,
      execution.outcome.errorMessage,
      execution,
      ports,
    );
  }

  const finished = finishStepRunSucceeded(
    {
      runId,
      stepRunId,
      startedAtMs,
      output: execution.outcome.output,
      ...(execution.tokens !== undefined && { tokens: execution.tokens }),
      ...(execution.resultSubtype !== undefined && { resultSubtype: execution.resultSubtype }),
      ...(execution.numTurns !== undefined && { numTurns: execution.numTurns }),
    },
    ports,
  );
  if (finished.kind === 'error') {
    return finished;
  }
  // eslint-disable-next-line unicorn/no-null -- a `NodeExecutionOutcome.selectedBranchKey` `null` értéke a "minden nem `on_error` kimenő él live" jelentés (node-executor-outcome.ts), az agent lépés nem elágazó node
  return { kind: 'ok', value: { kind: 'succeeded', stepRun: finished.value, selectedBranchKey: null } };
}

/**
 * A `agent_step` és a `join` `ai_synthesis` móda közös élettartama (SPEC-004
 * 5.2 TELJES tíz pontja, 7.2): `createStepRun` `pending` állapotban, hely
 * kérése a szabályozótól, csak azután `markStepRunning` (1. pont), a
 * `runAgentStep` teljes futtatása, záró `markStepSucceeded`/`markStepFailed`,
 * és a hely felszabadítása **minden ágon**, a hibaágakon és a `runAgentStep`
 * saját `Outcome` hibaágán is (10. pont).
 *
 * A hely felszabadítása `try/finally` blokkban áll, `return`-nel a `finally`
 * ágban: a projekt ESLint szabálykészlete nem tiltja a `finally`-ből való
 * visszatérést (nincs `no-unsafe-finally` bekötve), ez pedig a legegyenesebb
 * módja annak, hogy a felszabadítás **mindig** lefusson, a `runAfterSlotGranted`
 * bármelyik ágán is záruljon. Ha a felszabadítás hibázik
 * (`unknown_concurrency_slot`, valódi programhiba, lásd
 * `packages/engine/CLAUDE.md`), az a végeredmény: a lépés saját kimenetele
 * ilyenkor eldobódik, mert egy hibás szabályozó állapot súlyosabb, mint egy
 * egyébként lezárt lépés eredménye.
 *
 * **Az `agentQueryRegistry` paramétert változatlanul továbbadja a
 * `runAgentStep`-nek** (SPEC-004 9. szekció 3. pont, PLAN-005 T-005-26): ez a
 * réteg maga nem regisztrál semmit, csak a hely kérésének/felszabadításának
 * felelőse marad, a regisztráció ott történik, ahol az élő `AgentQuery`
 * objektum ténylegesen keletkezik (`agent-step/run-agent-step.ts`).
 */
export async function runAgentNodeLifecycle(
  input: AgentNodeLifecycleInput,
  ports: EngineDependencies,
  gate: ConcurrencyGate,
  agentQueryRegistry: AgentQueryRegistry,
): Promise<Outcome<NodeExecutionOutcome>> {
  const { instance, nodeType, config } = input;
  const nodeId = instance.instance.nodeId;
  const { runId, providerId } = instance;

  const created = ports.database.stepRuns.createStepRun({
    runId,
    nodeId,
    nodeType,
    parentStepRunId: instance.parentStepRunId,
    iteration: instance.iteration,
    attempt: instance.attempt,
    providerId,
    modelId: config.modelId,
    sessionMode: config.sessionMode,
    /* eslint-disable-next-line unicorn/no-null -- a `structuredOutputStrategy` `T | null` mező valódi kezdő értéke, ha a lépés nem vár strukturált kimenetet (SPEC-003 9.2) */
    structuredOutputStrategy: config.structuredOutput === null ? null : config.structuredOutput.strategy,
    // eslint-disable-next-line unicorn/no-null -- az `agent_step` és a `join` `ai_synthesis` sosem al-workflow hívás
    subWorkflowRunId: null,
  });
  if (created.kind === 'error') {
    return created;
  }
  const stepRunId = created.value.id;

  await new Promise<void>((resolve) => {
    gate.requestSlot(providerId, stepRunId, resolve);
  });

  try {
    return await runAfterSlotGranted(input, stepRunId, ports, agentQueryRegistry);
  } finally {
    const released = gate.releaseSlot(stepRunId);
    if (released.kind === 'error') {
      return released;
    }
  }
}
