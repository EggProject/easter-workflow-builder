/* eslint-disable unicorn/no-null -- az `AgentStepConfig`, a `CreateStepRunInput` és a `Fact<T | null>` nullázható mezői (SPEC-003 4.4, 9.2, SPEC-000 5.) a tárolt/mért alakban valódi `null` értéket hordoznak, nem helyőrző `undefined`-et */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { AgentQueryRunner } from '@easter-workflow-builder/agent';
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
import type { EngineDependencies } from '../engine-port/engine-dependencies.ts';
import type { EventPublisherPort } from '../engine-port/event-publisher-port.ts';
import type { TemplateRendererPort } from '../engine-port/template-renderer-port.ts';
import { createAgentQueryRegistry } from '../run-interrupt/agent-query-registry.ts';
import type { ExecutableNodeConfig } from '../run-validation/executable-node-config.ts';
import { executeAgentStep } from './execute-agent-step.ts';
import type { NodeExecutionInstance } from './node-executor-instance.ts';

type AgentStepNodeConfig = Extract<ExecutableNodeConfig, { readonly type: 'agent_step' }>;

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (!isOkOutcome(outcome)) {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

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
function fakeRunner(messages: readonly unknown[]): AgentQueryRunner {
  return {
    run: () => ({ kind: 'ok', value: { messages: messageIterable(messages), interrupt: () => Promise.resolve() } }),
  };
}

const notCalled = (): never => {
  throw new Error('ebben a tesztben nem hívott port');
};

function knownFact<TValue>(value: TValue): Fact<TValue> {
  return { state: 'known', value, evidence: [{ kind: 'measurement', id: 'M-01' }] };
}

function model(id: string): ModelDescriptor<string, string> {
  return {
    id,
    family: 'csalad-1',
    clientModelIdentifier: knownFact(`${id}-kliens`),
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

function descriptor(): ProviderCapabilityDescriptor<string, string> {
  return {
    id: 'minimax',
    displayName: 'MiniMax teszt',
    sdkVersionPin: '0.0.0-teszt',
    measuredAt: '2026-08-28',
    requiredEnv: [],
    disallowedEnv: [],
    models: [model('modell-1')],
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
  };
}

function agentStepConfig(overrides: Partial<AgentStepConfig> = {}): AgentStepNodeConfig {
  return {
    type: 'agent_step',
    onUnhandledError: null,
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
    database.workflows.createWorkflow({ name: 'execute-agent-step teszt', description: null, providerId: null }),
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

function dependenciesOf(
  database: DatabaseContext,
  agentQueryRunner: AgentQueryRunner,
  eventPublisher?: EventPublisherPort,
): EngineDependencies {
  const renderer: TemplateRendererPort = {
    render: (template) => ({ kind: 'ok', value: `renderelt: ${template}` }),
    compile: notCalled,
  };
  // Az alapértelmezett kiadó nyelő: a legtöbb teszt nem a kimenő eseményeket
  // vizsgálja, csak a port jelenlétét igényli.
  // eslint-disable-next-line @typescript-eslint/no-empty-function -- lásd a fenti indoklást
  const publisher: EventPublisherPort = { publish: () => {} };
  return {
    database,
    agentQueryRunner,
    providerDescriptorLookup: notCalled,
    expressionEvaluator: { evaluate: notCalled, compile: notCalled },
    templateRenderer: renderer,
    eventPublisher: eventPublisher ?? publisher,
    clock: (() => {
      let now = 0;
      return { nowMs: () => (now += 5), sleep: notCalled };
    })(),
    idGenerator: { nextId: notCalled },
    processEnvironment: { read: () => null },
  };
}

function recordingGate(): { readonly gate: ConcurrencyGate; readonly calls: readonly string[] } {
  const calls: string[] = [];
  const gate: ConcurrencyGate = {
    requestSlot: (providerId, requestId, onGranted) => {
      calls.push(`request:${providerId}:${requestId}`);
      onGranted();
    },
    releaseSlot: (requestId) => {
      calls.push(`release:${requestId}`);
      return { kind: 'ok', value: undefined };
    },
    occupiedSlotCount: () => 0,
    waitingRequestCount: () => 0,
  };
  return { gate, calls };
}

describe('executeAgentStep', () => {
  it('sikeres futtatás: a step_run node_type agent_step, a hely kérése és felszabadítása megtörténik', async () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const { gate, calls } = recordingGate();
    const dependencies = dependenciesOf(database, fakeRunner(fixtureMessages('sikeres')));

    const outcome = okOrThrow(
      await executeAgentStep(
        {
          instance: instanceOf(runId),
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
        },
        dependencies,
        gate,
        createAgentQueryRegistry(),
      ),
    );

    expect(outcome.kind).toBe('succeeded');
    expect(outcome.stepRun.nodeType).toBe('agent_step');
    expect(calls).toStrictEqual([`request:minimax:${outcome.stepRun.id}`, `release:${outcome.stepRun.id}`]);

    database.close();
  });

  it('hibás result subtype esetén failed kimenetet ad, a hely akkor is felszabadul', async () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const { gate, calls } = recordingGate();
    const dependencies = dependenciesOf(database, fakeRunner(fixtureMessages('hibasSubtype')));

    const outcome = okOrThrow(
      await executeAgentStep(
        {
          instance: instanceOf(runId),
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
        },
        dependencies,
        gate,
        createAgentQueryRegistry(),
      ),
    );

    expect(outcome.kind).toBe('failed');
    expect(outcome.kind === 'failed' ? outcome.errorKind : '').toBe('agent_result_not_success');
    expect(calls.some((call) => call.startsWith('release:'))).toBe(true);

    database.close();
  });
});
