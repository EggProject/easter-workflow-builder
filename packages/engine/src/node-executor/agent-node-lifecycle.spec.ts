/* eslint-disable unicorn/no-null -- az `AgentStepConfig`, a `CreateStepRunInput` és a `Fact<T | null>` nullázható mezői (SPEC-003 4.4, 9.2, SPEC-000 5.) a tárolt/mért alakban valódi `null` értéket hordoznak, nem helyőrző `undefined`-et */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { AgentQueryRequest, AgentQueryRunner } from '@easter-workflow-builder/agent';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import type {
  AgentStepConfig,
  DatabaseContext,
  NodeType,
  SnapshotEdge,
  SnapshotNode,
} from '@easter-workflow-builder/db';
import { openDatabase } from '@easter-workflow-builder/db';
import type { Fact, ModelDescriptor, ProviderCapabilityDescriptor } from '@easter-workflow-builder/provider-capability';
import { buildExecutableGraph } from '../run-graph/build-executable-graph.ts';
import type { ExecutableGraph } from '../run-graph/executable-graph.ts';
import type { ConcurrencyGate } from '../concurrency-gate/concurrency-gate.ts';
import { createConcurrencyGate } from '../concurrency-gate/create-concurrency-gate.ts';
import type { EngineDependencies } from '../engine-port/engine-dependencies.ts';
import type { EventPublisherPort } from '../engine-port/event-publisher-port.ts';
import type { TemplateRendererPort } from '../engine-port/template-renderer-port.ts';
import { createAgentQueryRegistry } from '../run-interrupt/agent-query-registry.ts';
import { runAgentNodeLifecycle, type AgentNodeLifecycleInput } from './agent-node-lifecycle.ts';
import type { NodeExecutionInstance } from './node-executor-instance.ts';

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (!isOkOutcome(outcome)) {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

// Lokális, tesztre szűkített guardok, ugyanaz a minta, mint a
// `run-agent-step.spec.ts`-ben: a commitolt fixture JSON gyökere rekord, a
// sorozatai tömbök.
function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}
function isFixtureRoot(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function fixtureMessages(name: string): readonly unknown[] {
  const text = readFileSync(new URL('../agent-step/agent-step-messages-fixture.json', import.meta.url), 'utf8');
  const parsed: unknown = JSON.parse(text);
  const sequence = isFixtureRoot(parsed) ? parsed[name] : undefined;
  if (!isUnknownArray(sequence)) {
    throw new Error(`a(z) ${name} fixture sorozat hiányzik vagy nem tömb`);
  }
  return sequence;
}

function node(id: string, type: NodeType): SnapshotNode {
  return { id, type, label: id, position: { x: 0, y: 0 }, config: {}, effectiveProviderId: 'minimax' };
}
function edge(id: string, sourceNodeId: string, targetNodeId: string): SnapshotEdge {
  return { id, sourceNodeId, targetNodeId, sourceHandle: null, targetHandle: null, branchKey: null };
}
const graph: ExecutableGraph = buildExecutableGraph({
  version: 1,
  sdkVersionPin: '0.0.0-teszt',
  workflow: { id: 'wf', name: 'teszt', description: null },
  nodes: [node('start', 'start'), node('a', 'agent_step')],
  edges: [edge('e1', 'start', 'a')],
});

function messageIterable(messages: readonly unknown[]): AsyncIterable<unknown> {
  return {
    [Symbol.asyncIterator]: () => {
      let index = 0;
      return {
        next: (): Promise<IteratorResult<unknown>> => {
          const value = messages[index];
          index += 1;
          return Promise.resolve(value === undefined ? { done: true, value: undefined } : { done: false, value });
        },
      };
    },
  };
}

function fakeRunner(
  messages: readonly unknown[],
  captured: { request: AgentQueryRequest | undefined },
): AgentQueryRunner {
  return {
    run: (request) => {
      captured.request = request;
      return { kind: 'ok', value: { messages: messageIterable(messages), interrupt: () => Promise.resolve() } };
    },
  };
}

function neverCalledRunner(captured: { called: boolean }): AgentQueryRunner {
  return {
    run: () => {
      captured.called = true;
      return { kind: 'ok', value: { messages: messageIterable([]), interrupt: () => Promise.resolve() } };
    },
  };
}

const notCalled = (): never => {
  throw new Error('ebben a tesztben nem hívott port');
};

// A regiszter szerepe ebben a fájlban pusztán instrumentális: a lépés
// életciklusa (`runAgentNodeLifecycle`) megköveteli, de ez a téma nem a
// regiszter viselkedését teszteli (lásd `run-interrupt/agent-query-registry.spec.ts`
// és `agent-step/run-agent-step.spec.ts`), ezért egyetlen, minden teszt által
// megosztott példány elég.
const agentQueryRegistry = createAgentQueryRegistry();

function knownFact<TValue>(value: TValue): Fact<TValue> {
  return { state: 'known', value, evidence: [{ kind: 'measurement', id: 'M-01' }] };
}
function unknownFact<TValue>(): Fact<TValue> {
  return { state: 'unknown', reason: 'a mérés még nem futott le', blockedBy: ['M-99'] };
}

function model(id: string, clientModelIdentifier: Fact<string>): ModelDescriptor<string, string> {
  return {
    id,
    family: 'csalad-1',
    clientModelIdentifier,
    contextWindow: knownFact(1000),
    effectiveContextWindowOnWire: knownFact(1000),
    maxOutputTokensRecommended: knownFact(100),
    maxOutputTokensHard: knownFact(200),
    maxOutputTokensWireCeiling: knownFact(200),
    imageInput: knownFact(false),
    videoInput: knownFact(false),
    listedByModelsEndpoint: knownFact(false),
  };
}

/**
 * A `ProviderCapabilityDescriptor` teljes alakja - nem csak a
 * `validateAgentStepCapabilities` által olvasott hét mező -, mert a
 * `runAgentNodeLifecycle` bemenete a **teljes**, már feloldott leíró
 * (a hívó, a jövőbeli `run-supervisor`, ezt adja át változtatás nélkül).
 */
function descriptor(
  overrides: Partial<ProviderCapabilityDescriptor<string, string>> = {},
): ProviderCapabilityDescriptor<string, string> {
  return {
    id: 'minimax',
    displayName: 'MiniMax teszt',
    sdkVersionPin: '0.0.0-teszt',
    measuredAt: '2026-08-28',
    requiredEnv: [],
    disallowedEnv: [],
    models: [model('modell-1', knownFact('modell-1-kliens'))],
    thinking: {
      byModelFamily: { 'csalad-1': knownFact(['adaptive', 'disabled']) },
      wireShape: knownFact('{"type":"adaptive"}'),
      sendsBudgetTokens: knownFact(false),
      interleavedSignatureRequired: knownFact(false),
      streamEventTypes: knownFact([]),
    },
    effort: { accepted: knownFact(true), wireField: knownFact(null) },
    toolChoice: {
      accepted: knownFact(['auto', 'none']),
      rejectionBehaviour: knownFact('silently_dropped'),
      sdkSendsForcedChoice: knownFact(false),
    },
    structuredOutput: {
      strategies: [
        {
          id: 'emit_output_tool',
          usable: knownFact(true),
          blockingWireDetail: knownFact(null),
          observedRoundTrips: knownFact([3]),
        },
      ],
      defaultStrategy: knownFact('emit_output_tool'),
      outputConfigAlwaysSent: knownFact(false),
      outputConfigWireField: knownFact(null),
    },
    serverTools: knownFact([]),
    streaming: {
      sse: knownFact(true),
      toolInputDelta: knownFact('input_json_delta'),
      sdkReassemblesToolInput: knownFact(true),
      fineGrainedToolStreaming: knownFact(false),
      streamDisableable: knownFact(false),
    },
    promptCaching: {
      mode: knownFact('none'),
      explicitBreakpointLimit: knownFact(0),
      ttlSeconds: knownFact(0),
      minimumInputTokens: knownFact(0),
      usageFields: knownFact([]),
      disableEnvVar: knownFact(null),
      callerBreakpointSurvivesDisable: knownFact(false),
    },
    recommendedAgentTools: knownFact([]),
    modelsEndpoint: {
      directHttpReachable: knownFact(false),
      calledBySdk: knownFact(false),
      listedModelCount: knownFact(0),
    },
    rateLimits: { buckets: [], retryAfterHeader: knownFact(null), rateLimitHeaders: knownFact([]) },
    concurrency: {
      subagentCapEnvVar: knownFact(null),
      measuredSubagentCap: knownFact(1),
      observedMaxConcurrentRequests: knownFact(1),
      measuredMaxConcurrentSteps: knownFact(20),
    },
    anthropicBetaHeaders: knownFact([]),
    ...overrides,
  };
}

function agentStepConfig(overrides: Partial<AgentStepConfig> = {}): AgentStepConfig {
  return {
    promptTemplate: 'Számold ki: {{bemenet}}',
    providerId: null,
    modelId: 'modell-1',
    effort: null,
    thinking: null,
    allowedTools: [],
    disallowedTools: [],
    permissionMode: null,
    maxTurns: null,
    maxBudgetUsd: null,
    systemPrompt: null,
    agents: {},
    skills: null,
    mcpServers: {},
    enabledEngineHooks: [],
    cwd: null,
    additionalDirectories: [],
    sandbox: null,
    agentTools: [],
    sessionMode: 'isolated',
    structuredOutput: null,
    ...overrides,
  };
}

function openMemoryDatabase(): DatabaseContext {
  return okOrThrow(openDatabase(':memory:'));
}

function seedRun(database: DatabaseContext): { readonly runId: string } {
  const workflow = okOrThrow(
    database.workflows.createWorkflow({ name: 'agent-node-lifecycle teszt', description: null, providerId: null }),
  );
  const snapshot = {
    version: 1,
    sdkVersionPin: '0.0.0-teszt',
    workflow: { id: workflow.id, name: workflow.name, description: null },
    nodes: [],
    edges: [],
  } as const;
  const run = okOrThrow(
    database.runs.startRun({
      workflowId: workflow.id,
      input: {},
      providerId: 'minimax',
      graphSnapshotDocument: snapshot,
    }),
  );
  return { runId: run.id };
}

function instanceOf(runId: string): NodeExecutionInstance {
  return {
    runId,
    instance: { nodeId: 'a', branchContext: [] },
    parentStepRunId: null,
    iteration: 0,
    attempt: 1,
    providerId: 'minimax',
  };
}

function dependenciesOf(parts: {
  readonly database: DatabaseContext;
  readonly agentQueryRunner: AgentQueryRunner;
  readonly eventPublisher?: EventPublisherPort;
  readonly templateRenderer?: TemplateRendererPort;
}): EngineDependencies {
  const renderer: TemplateRendererPort = {
    render: (template) => ({ kind: 'ok', value: `renderelt: ${template}` }),
    compile: notCalled,
  };
  // Az alapértelmezett kiadó nyelő: a legtöbb teszt nem a kimenő eseményeket
  // vizsgálja, csak a port jelenlétét igényli.
  // eslint-disable-next-line @typescript-eslint/no-empty-function -- lásd a fenti indoklást
  const publisher: EventPublisherPort = { publish: () => {} };
  return {
    database: parts.database,
    agentQueryRunner: parts.agentQueryRunner,
    providerDescriptorLookup: notCalled,
    expressionEvaluator: { evaluate: notCalled, compile: notCalled },
    templateRenderer: parts.templateRenderer ?? renderer,
    eventPublisher: parts.eventPublisher ?? publisher,
    clock: (() => {
      let now = 0;
      return { nowMs: () => (now += 5), sleep: notCalled };
    })(),
    idGenerator: { nextId: notCalled },
    processEnvironment: { read: () => null },
  };
}

/**
 * Rögzítő szabályozó: minden `requestSlot` hívást azonnal jóváhagy, és
 * sorban naplózza, mikor kért, illetve szabadított fel helyet a hívó
 * (SPEC-004 5.2 1. és 10. pont). A `releaseOverride` egy adott
 * `releaseSlot` hívás eredményét cserélheti le, hogy a hiba felülírási
 * útvonal tesztelhető legyen.
 */
function recordingGate(releaseOverride?: (requestId: string) => Outcome<void>): {
  readonly gate: ConcurrencyGate;
  readonly calls: readonly string[];
} {
  const calls: string[] = [];
  const gate: ConcurrencyGate = {
    requestSlot: (providerId, requestId, onGranted) => {
      calls.push(`request:${providerId}:${requestId}`);
      onGranted();
    },
    releaseSlot: (requestId) => {
      calls.push(`release:${requestId}`);
      return releaseOverride === undefined ? { kind: 'ok', value: undefined } : releaseOverride(requestId);
    },
    occupiedSlotCount: () => 0,
    waitingRequestCount: () => 0,
  };
  return { gate, calls };
}

function inputOf(runId: string, overrides: Partial<AgentNodeLifecycleInput> = {}): AgentNodeLifecycleInput {
  return {
    instance: instanceOf(runId),
    nodeType: 'agent_step',
    config: agentStepConfig(),
    descriptor: descriptor(),
    runContext: {
      input: {},
      steps: {},
      item: undefined,
      itemIndex: undefined,
      iteration: undefined,
      joinInputs: undefined,
      error: undefined,
    },
    graph,
    sessionSourceNodes: { sourceNodeIds: new Set(['a']), continuedNodeIds: new Set() },
    sessionInstances: [],
    ...overrides,
  };
}

describe('runAgentNodeLifecycle', () => {
  it('sikeres futtatás: a hely kérése a markStepRunning ELŐTT történik, majd a hely felszabadul, a step_run succeeded, resultSubtype/numTurns/tokens tárolva', async () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const captured: { request: AgentQueryRequest | undefined } = { request: undefined };
    const published: unknown[] = [];
    const { gate, calls } = recordingGate();
    let stepRunIdAtGrant: string | undefined;
    const observingGate: ConcurrencyGate = {
      ...gate,
      requestSlot: (providerId, requestId, onGranted) => {
        // A hely kérésekor a step_run MÉG pending, mert a markStepRunning csak
        // a hely megszerzése UTÁN fut le (SPEC-004 5.2 1. pont).
        const beforeRunning = okOrThrow(database.stepRuns.getStepRun(requestId));
        expect(beforeRunning.status).toBe('pending');
        stepRunIdAtGrant = requestId;
        gate.requestSlot(providerId, requestId, onGranted);
      },
    };
    const dependencies = dependenciesOf({
      database,
      agentQueryRunner: fakeRunner(fixtureMessages('sikeres'), captured),
      eventPublisher: {
        publish: (event) => {
          published.push(event);
        },
      },
    });

    const outcome = okOrThrow(
      await runAgentNodeLifecycle(inputOf(runId), dependencies, observingGate, agentQueryRegistry),
    );

    expect(outcome.kind).toBe('succeeded');
    expect(stepRunIdAtGrant).toBe(outcome.stepRun.id);
    expect(calls).toStrictEqual([`request:minimax:${outcome.stepRun.id}`, `release:${outcome.stepRun.id}`]);
    expect(outcome.stepRun.status).toBe('succeeded');
    expect(outcome.stepRun.resultSubtype).toBe('success');
    expect(outcome.stepRun.numTurns).toBe(3);
    expect(outcome.stepRun.inputTokens).toBe(11);

    const startedEvent = published.find(
      (event): event is { kind: string } =>
        typeof event === 'object' && event !== null && 'kind' in event && event.kind === 'step_started',
    );
    expect(startedEvent).toStrictEqual({
      kind: 'step_started',
      runId,
      stepRunId: outcome.stepRun.id,
      payload: { nodeId: 'a', nodeType: 'agent_step', providerId: 'minimax', attempt: 1, iteration: 0 },
    });

    database.close();
  });

  it('unproven jelölők: unknown clientModelIdentifier esetén a step_started payload modelIdentifierUnproven: true értéket hordoz', async () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const published: unknown[] = [];
    const { gate } = recordingGate();
    const dependencies = dependenciesOf({
      database,
      agentQueryRunner: fakeRunner(fixtureMessages('sikeres'), { request: undefined }),
      eventPublisher: {
        publish: (event) => {
          published.push(event);
        },
      },
    });
    const models = [model('modell-1', unknownFact())];
    const input = inputOf(runId, { descriptor: descriptor({ models }) });

    await runAgentNodeLifecycle(input, dependencies, gate, agentQueryRegistry);

    const startedEvent = published.find(
      (event): event is { payload: Record<string, unknown> } =>
        typeof event === 'object' && event !== null && 'kind' in event && event.kind === 'step_started',
    );
    expect(startedEvent?.payload['modelIdentifierUnproven']).toBe(true);

    database.close();
  });

  it('unproven jelölők: unknown strukturált kimenet stratégia és unknown serverTools esetén mindkét jelölő true', async () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const published: unknown[] = [];
    const { gate } = recordingGate();
    const dependencies = dependenciesOf({
      database,
      agentQueryRunner: fakeRunner(fixtureMessages('sikeres'), { request: undefined }),
      eventPublisher: {
        publish: (event) => {
          published.push(event);
        },
      },
    });
    const input = inputOf(runId, {
      config: agentStepConfig({ structuredOutput: { strategy: 'emit_output_tool', schema: {} } }),
      descriptor: descriptor({
        structuredOutput: {
          strategies: [
            {
              id: 'emit_output_tool',
              usable: unknownFact(),
              blockingWireDetail: knownFact(null),
              observedRoundTrips: knownFact([3]),
            },
          ],
          defaultStrategy: knownFact('emit_output_tool'),
          outputConfigAlwaysSent: knownFact(false),
          outputConfigWireField: knownFact(null),
        },
        serverTools: unknownFact(),
      }),
    });

    await runAgentNodeLifecycle(input, dependencies, gate, agentQueryRegistry);

    const startedEvent = published.find(
      (event): event is { payload: Record<string, unknown> } =>
        typeof event === 'object' && event !== null && 'kind' in event && event.kind === 'step_started',
    );
    expect(startedEvent?.payload['strategyUnproven']).toBe(true);
    expect(startedEvent?.payload['serverToolAvailabilityUnproven']).toBe(true);
    expect(startedEvent?.payload['modelIdentifierUnproven']).toBeUndefined();

    database.close();
  });

  it('strukturált kimenetet kérő, egyébként teljesen bizonyított lépésnél a step_started payload egyetlen jelölőt sem hordoz', async () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const published: unknown[] = [];
    const { gate } = recordingGate();
    const dependencies = dependenciesOf({
      database,
      agentQueryRunner: fakeRunner(fixtureMessages('sikeres'), { request: undefined }),
      eventPublisher: {
        publish: (event) => {
          published.push(event);
        },
      },
    });
    const input = inputOf(runId, {
      config: agentStepConfig({ structuredOutput: { strategy: 'emit_output_tool', schema: {} } }),
    });

    await runAgentNodeLifecycle(input, dependencies, gate, agentQueryRegistry);

    const startedEvent = published.find(
      (event): event is { payload: Record<string, unknown> } =>
        typeof event === 'object' && event !== null && 'kind' in event && event.kind === 'step_started',
    );
    expect(startedEvent?.payload).toStrictEqual({
      nodeId: 'a',
      nodeType: 'agent_step',
      providerId: 'minimax',
      attempt: 1,
      iteration: 0,
    });

    database.close();
  });

  it('hibás result subtype: a lépés failed, a resultSubtype/numTurns/tokens akkor is tárolva, a hely felszabadul', async () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const { gate, calls } = recordingGate();
    const dependencies = dependenciesOf({
      database,
      agentQueryRunner: fakeRunner(fixtureMessages('hibasSubtype'), { request: undefined }),
    });

    const outcome = okOrThrow(await runAgentNodeLifecycle(inputOf(runId), dependencies, gate, agentQueryRegistry));

    expect(outcome.kind).toBe('failed');
    expect(outcome.kind === 'failed' ? outcome.errorKind : '').toBe('agent_result_not_success');
    expect(outcome.stepRun.resultSubtype).toBe('error_max_turns');
    expect(outcome.stepRun.numTurns).toBe(8);
    expect(outcome.stepRun.inputTokens).toBe(5);
    expect(calls.some((call) => call.startsWith('release:'))).toBe(true);

    database.close();
  });

  it('leíró szintű capability hiba (unknown_model_id) azonnal lezárja a lépést, az agentQueryRunner-t nem hívja, de a hely kérése/felszabadítása megtörténik', async () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const runnerCalled = { called: false };
    const { gate, calls } = recordingGate();
    const dependencies = dependenciesOf({ database, agentQueryRunner: neverCalledRunner(runnerCalled) });
    const input = inputOf(runId, { config: agentStepConfig({ modelId: 'ismeretlen' }) });

    const outcome = okOrThrow(await runAgentNodeLifecycle(input, dependencies, gate, agentQueryRegistry));

    expect(outcome.kind).toBe('failed');
    expect(outcome.kind === 'failed' ? outcome.errorKind : '').toBe('unknown_model_id');
    expect(runnerCalled.called).toBe(false);
    expect(calls).toStrictEqual([`request:minimax:${outcome.stepRun.id}`, `release:${outcome.stepRun.id}`]);

    database.close();
  });

  it('createStepRun hibája esetén a hely kérése meg sem történik', async () => {
    const database = openMemoryDatabase();
    seedRun(database);
    const { gate, calls } = recordingGate();
    const dependencies = dependenciesOf({
      database,
      agentQueryRunner: fakeRunner(fixtureMessages('sikeres'), { request: undefined }),
    });
    const input = inputOf('nincs-ilyen-futas');

    const outcome = await runAgentNodeLifecycle(input, dependencies, gate, agentQueryRegistry);

    expect(outcome.kind).toBe('error');
    expect(calls).toStrictEqual([]);

    database.close();
  });

  it('a hely felszabadításának hibája (unknown_concurrency_slot) felülírja az egyébként sikeres kimenetelt', async () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const { gate } = recordingGate(() => ({ kind: 'error', message: 'ismeretlen hely (unknown_concurrency_slot).' }));
    const dependencies = dependenciesOf({
      database,
      agentQueryRunner: fakeRunner(fixtureMessages('sikeres'), { request: undefined }),
    });

    const outcome = await runAgentNodeLifecycle(inputOf(runId), dependencies, gate, agentQueryRegistry);

    expect(outcome.kind).toBe('error');
    expect(outcome.kind === 'error' ? outcome.message : '').toContain('unknown_concurrency_slot');

    database.close();
  });

  it('a markStepRunning hibáját (a hely megszerzése után, versenyhelyzetben megváltozott állapot) az Outcome hibaágán adja tovább', async () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    // A hely jóváhagyásakor, MÉG a markStepRunning ELŐTT, a lépés futást
    // kívülről cancelled állapotba visszük: a pending -> cancelled átmenet
    // engedett (SPEC-003 7.2), a cancelled -> running viszont nem, tehát a
    // következő markStepRunning hívás illegal_status_transition hibát ad.
    const { gate } = recordingGate();
    const racyGate: ConcurrencyGate = {
      ...gate,
      requestSlot: (providerId, requestId, onGranted) => {
        gate.requestSlot(providerId, requestId, () => {
          okOrThrow(database.stepRuns.markStepCancelled(requestId));
          onGranted();
        });
      },
    };
    const dependencies = dependenciesOf({
      database,
      agentQueryRunner: fakeRunner(fixtureMessages('sikeres'), { request: undefined }),
    });

    const outcome = await runAgentNodeLifecycle(inputOf(runId), dependencies, racyGate, agentQueryRegistry);

    expect(outcome.kind).toBe('error');
    expect(outcome.kind === 'error' ? outcome.message : '').toContain('illegal_status_transition');

    database.close();
  });

  it('a step_started esemény írásának hibáját az Outcome hibaágán adja tovább, ha a kapcsolat időközben lezárul', async () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const { gate } = recordingGate();
    const racyDatabase: DatabaseContext = {
      ...database,
      stepRuns: {
        ...database.stepRuns,
        markStepRunning: (id) => {
          const result = database.stepRuns.markStepRunning(id);
          database.close();
          return result;
        },
      },
    };
    const dependencies = dependenciesOf({
      database: racyDatabase,
      agentQueryRunner: fakeRunner(fixtureMessages('sikeres'), { request: undefined }),
    });

    const outcome = await runAgentNodeLifecycle(inputOf(runId), dependencies, gate, agentQueryRegistry);

    expect(outcome.kind).toBe('error');
  });

  it('a záró markStepFailed hibáját az Outcome hibaágán adja tovább (capability hiba után a sor időközben cancelled lett)', async () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const { gate } = recordingGate();
    const racyDatabase: DatabaseContext = {
      ...database,
      events: {
        ...database.events,
        appendEngineEvent: (input) => {
          const result = database.events.appendEngineEvent(input);
          if (result.kind === 'ok' && input.kind === 'step_started' && input.stepRunId !== null) {
            okOrThrow(database.stepRuns.markStepCancelled(input.stepRunId));
          }
          return result;
        },
      },
    };
    const dependencies = dependenciesOf({
      database: racyDatabase,
      agentQueryRunner: fakeRunner(fixtureMessages('sikeres'), { request: undefined }),
    });
    const input = inputOf(runId, { config: agentStepConfig({ modelId: 'ismeretlen' }) });

    const outcome = await runAgentNodeLifecycle(input, dependencies, gate, agentQueryRegistry);

    expect(outcome.kind).toBe('error');
    expect(outcome.kind === 'error' ? outcome.message : '').toContain('illegal_status_transition');
  });

  it('a záró markStepSucceeded hibáját az Outcome hibaágán adja tovább (sikeres futtatás után a sor időközben cancelled lett)', async () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const { gate } = recordingGate();
    const racyDatabase: DatabaseContext = {
      ...database,
      events: {
        ...database.events,
        appendEngineEvent: (input) => {
          const result = database.events.appendEngineEvent(input);
          if (result.kind === 'ok' && input.kind === 'step_started' && input.stepRunId !== null) {
            okOrThrow(database.stepRuns.markStepCancelled(input.stepRunId));
          }
          return result;
        },
      },
    };
    const dependencies = dependenciesOf({
      database: racyDatabase,
      agentQueryRunner: fakeRunner(fixtureMessages('sikeres'), { request: undefined }),
    });

    const outcome = await runAgentNodeLifecycle(inputOf(runId), dependencies, gate, agentQueryRegistry);

    expect(outcome.kind).toBe('error');
    expect(outcome.kind === 'error' ? outcome.message : '').toContain('illegal_status_transition');
  });

  it('a runAgentStep saját Outcome hibaága (adatbázis hiba) mellett is felszabadul a hely', async () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const { gate, calls } = recordingGate();
    const dependencies = dependenciesOf({
      database,
      agentQueryRunner: fakeRunner(fixtureMessages('sikeres'), { request: undefined }),
      eventPublisher: {
        publish: () => {
          // A kiadás a hozzáfűzés és a session csatolás KÖZÖTT fut (SPEC-004
          // 5.2 6. és 7. pont): itt zárjuk le a kapcsolatot, hogy a
          // runAgentStep Outcome hibaága determinisztikusan előidézhető
          // legyen, ugyanaz a minta, mint a `run-agent-step.spec.ts`-ben.
          database.close();
        },
      },
    });

    const outcome = await runAgentNodeLifecycle(inputOf(runId), dependencies, gate, agentQueryRegistry);

    expect(outcome.kind).toBe('error');
    expect(calls.some((call) => call.startsWith('release:'))).toBe(true);
  });

  it('valós szabályozóval: a helyet a futás után a szabályozó ismét szabadnak látja', async () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const limits = new Map<string, number>([['minimax', 1]]);
    const gate = createConcurrencyGate((providerId) => limits.get(providerId) ?? null);
    const dependencies = dependenciesOf({
      database,
      agentQueryRunner: fakeRunner(fixtureMessages('sikeres'), { request: undefined }),
    });

    expect(gate.occupiedSlotCount('minimax')).toBe(0);
    await runAgentNodeLifecycle(inputOf(runId), dependencies, gate, agentQueryRegistry);
    expect(gate.occupiedSlotCount('minimax')).toBe(0);
    expect(gate.waitingRequestCount('minimax')).toBe(0);

    database.close();
  });

  it('a join nodeType-tal hívva a step_run node_type oszlopa join, nem agent_step', async () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const { gate } = recordingGate();
    const dependencies = dependenciesOf({
      database,
      agentQueryRunner: fakeRunner(fixtureMessages('sikeres'), { request: undefined }),
    });

    const outcome = okOrThrow(
      await runAgentNodeLifecycle(inputOf(runId, { nodeType: 'join' }), dependencies, gate, agentQueryRegistry),
    );

    expect(outcome.stepRun.nodeType).toBe('join');

    database.close();
  });
});
