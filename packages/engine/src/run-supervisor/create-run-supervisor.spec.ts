/* eslint-disable unicorn/no-null -- a node configok, a `WorkflowEdgeInput` és a `Fact<T | null>` nullázható mezői (SPEC-003 4.3, 4.7, SPEC-000 5.) a tárolt/mért alakban valódi `null` értéket hordoznak */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { AgentQueryRunner } from '@easter-workflow-builder/agent';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import type {
  AgentStepConfig,
  DatabaseContext,
  NodeConfig,
  StepRunRecord,
  UnhandledErrorPolicy,
  WorkflowEdgeInput,
  WorkflowNodeInput,
} from '@easter-workflow-builder/db';
import { openDatabase } from '@easter-workflow-builder/db';
import type {
  Fact,
  ModelDescriptor,
  ProviderCapabilityDescriptor,
  ProviderId,
} from '@easter-workflow-builder/provider-capability';
import { createConcurrencyGate } from '../concurrency-gate/create-concurrency-gate.ts';
import type { ClockPort } from '../engine-port/clock-port.ts';
import type { EngineDependencies } from '../engine-port/engine-dependencies.ts';
import type { EventPublisherPort } from '../engine-port/event-publisher-port.ts';
import type { ExpressionEvaluatorPort } from '../engine-port/expression-evaluator-port.ts';
import { createApprovalWaitRegistry } from '../node-executor/approval-wait-registry.ts';
import type { ApprovalWaitRegistry } from '../node-executor/approval-wait-registry.ts';
import type { ActiveRunHandle } from './active-run-registry.ts';
import { createRunSupervisor } from './create-run-supervisor.ts';
import type { RunSupervisor } from './run-supervisor.ts';

const INSTALLED = '0.0.0-teszt';

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

/**
 * A prompt sablon egyben a fixture sorozat neve: a hamis sablon renderelő a
 * sablont változatlanul adja vissza, tehát a teszt gráfban a `promptTemplate`
 * mező dönti el, hogy a lépés sikeres-e. Az `ELOSZOR-HIBA` prompt az
 * újrapróbálkozás tesztje: az ELSŐ hívásra hibás, utána sikeres válasz.
 */
function fakeRunner(): AgentQueryRunner {
  const callCounts = new Map<string, number>();
  let callIndex = 0;
  return {
    run: (request) => {
      const seen = callCounts.get(request.prompt) ?? 0;
      callCounts.set(request.prompt, seen + 1);
      callIndex += 1;
      let name = request.prompt;
      if (request.prompt === 'ELOSZOR-HIBA') {
        name = seen === 0 ? 'hibasSubtype' : 'sikeres';
      }
      // A commitolt fixture `uuid` értékei sorozatonként rögzítettek, a
      // `run_event` tábla viszont futásonként egyedi `sdk_uuid` értéket vár
      // (SPEC-003 6.5 idempotencia). Ugyanaz a sorozat több lépésben is
      // lefut, ezért a hívás sorszámával tesszük egyedivé.
      const messages = fixtureMessages(name).map((message) =>
        isFixtureRoot(message) ? { ...message, uuid: `${String(message['uuid'])}-${String(callIndex)}` } : message,
      );
      return {
        kind: 'ok',
        value: { messages: messageIterable(messages), interrupt: () => Promise.resolve() },
      };
    },
  };
}

/**
 * A hamis kifejezés kiértékelő: a kifejezés maga JSON literál, tehát a teszt
 * gráf közvetlenül írja le a döntést. Két különleges érték van: a `HIBA`
 * kiértékelési hibát ad, a `MEG-EGYSZER` pedig egy visszaszámlálót, ami
 * pontosan egy ciklus lefutást enged.
 */
function fakeEvaluator(): ExpressionEvaluatorPort {
  let remainingIterations = 2;
  return {
    evaluate: (expression) => {
      if (expression === 'HIBA') {
        return { kind: 'error', message: 'a kifejezés kiértékelése elhasalt' };
      }
      if (expression === 'MEG-EGYSZER') {
        remainingIterations -= 1;
        return { kind: 'ok', value: remainingIterations > 0 };
      }
      const value: unknown = JSON.parse(expression);
      return { kind: 'ok', value };
    },
    compile: () => ({ kind: 'ok', value: undefined }),
  };
}

interface SleepCall {
  readonly ms: number;
}

function fakeClock(sleepCalls: SleepCall[]): ClockPort {
  let now = 0;
  return {
    nowMs: () => {
      now += 1;
      return now;
    },
    sleep: (ms) => {
      sleepCalls.push({ ms });
      return Promise.resolve();
    },
  };
}
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

function descriptorOf(id: ProviderId): ProviderCapabilityDescriptor<string, string> {
  return {
    id,
    displayName: `leíró: ${id}`,
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

interface Harness {
  readonly database: DatabaseContext;
  readonly supervisor: RunSupervisor;
  readonly published: unknown[];
  readonly sleepCalls: SleepCall[];
  readonly approvalRegistry: ApprovalWaitRegistry;
}

interface HarnessOptions {
  readonly descriptorLookup?: (providerId: ProviderId) => ProviderCapabilityDescriptor<string, string>;
  readonly onPublish?: (event: unknown) => void;
  readonly withoutDefaultProvider?: boolean;
}

function openHarness(options: HarnessOptions = {}): Harness {
  const database = okOrThrow(openDatabase(':memory:'));
  const published: unknown[] = [];
  const sleepCalls: SleepCall[] = [];
  const approvalRegistry = createApprovalWaitRegistry();
  const publisher: EventPublisherPort = {
    publish: (event) => {
      published.push(event);
      options.onPublish?.(event);
    },
  };
  let nextId = 0;
  const ports: EngineDependencies = {
    database,
    agentQueryRunner: fakeRunner(),
    providerDescriptorLookup: options.descriptorLookup ?? descriptorOf,
    expressionEvaluator: fakeEvaluator(),
    templateRenderer: {
      render: (template) => ({ kind: 'ok', value: template }),
      compile: () => ({ kind: 'ok', value: undefined }),
    },
    eventPublisher: publisher,
    clock: fakeClock(sleepCalls),
    idGenerator: {
      nextId: () => {
        nextId += 1;
        return `id-${String(nextId)}`;
      },
    },
    processEnvironment: { read: () => null },
  };
  const supervisor = createRunSupervisor({
    ports,
    concurrencyGate: createConcurrencyGate(() => null),
    approvalRegistry,
    installedAgentSdkVersion: INSTALLED,
  });
  if (options.withoutDefaultProvider !== true) {
    okOrThrow(database.settings.setDefaultProvider('minimax'));
  }
  return { database, supervisor, published, sleepCalls, approvalRegistry };
}

function agentStepConfig(promptTemplate: string): AgentStepConfig {
  return {
    promptTemplate,
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
  };
}

function nodeOf(id: string, config: NodeConfig): WorkflowNodeInput {
  return { id, label: id, positionX: 0, positionY: 0, config };
}
function edgeOf(
  id: string,
  sourceNodeId: string,
  targetNodeId: string,
  branchKey: string | null = null,
): WorkflowEdgeInput {
  return { id, sourceNodeId, targetNodeId, sourceHandle: null, targetHandle: null, branchKey };
}

function startNode(id: string, required: readonly string[] = []): WorkflowNodeInput {
  return nodeOf(id, {
    type: 'start',
    inputFields: required.map((name) => ({ name, label: name, valueKind: 'string', required: true })),
    onUnhandledError: 'fail_run',
  });
}
function agentNode(
  id: string,
  promptTemplate: string,
  onUnhandledError: UnhandledErrorPolicy = 'fail_run',
): WorkflowNodeInput {
  return nodeOf(id, { type: 'agent_step', onUnhandledError, ...agentStepConfig(promptTemplate) });
}

function branchNode(id: string, expression: string, keys: readonly string[]): WorkflowNodeInput {
  return nodeOf(id, {
    type: 'branch',
    expression,
    branches: keys.map((key) => ({ key, label: key })),
    defaultBranchKey: null,
    onUnhandledError: 'fail_run',
  });
}
function fanOutNode(id: string, itemsExpression: string): WorkflowNodeInput {
  return nodeOf(id, { type: 'fan_out', itemsExpression, branchLabelTemplate: 'elem', onUnhandledError: 'fail_run' });
}
function joinMergeNode(id: string): WorkflowNodeInput {
  return nodeOf(id, { type: 'join', mode: 'merge', settings: {}, onUnhandledError: 'fail_run' });
}
function loopNode(id: string, continueExpression: string, maxIterations: number): WorkflowNodeInput {
  return nodeOf(id, { type: 'loop', maxIterations, continueExpression, onUnhandledError: 'fail_run' });
}
function approvalNode(id: string, timeoutMs: number | null): WorkflowNodeInput {
  return nodeOf(id, {
    type: 'human_approval',
    title: 'Kell egy döntés',
    bodyTemplate: 'szöveg',
    timeoutMs,
    onUnhandledError: 'fail_run',
  });
}
function errorHandlerNode(id: string, maxAttempts: number, backoffMs: readonly number[]): WorkflowNodeInput {
  return nodeOf(id, {
    type: 'error_handler',
    maxAttempts,
    backoffMs,
    handledErrorKinds: [],
    onUnhandledError: 'fail_run',
  });
}
function subWorkflowNode(id: string, targetWorkflowId: string): WorkflowNodeInput {
  return nodeOf(id, { type: 'sub_workflow', targetWorkflowId, inputMapping: {}, onUnhandledError: 'fail_run' });
}

function createWorkflow(
  database: DatabaseContext,
  name: string,
  nodes: readonly WorkflowNodeInput[],
  edges: readonly WorkflowEdgeInput[],
): string {
  const workflow = okOrThrow(database.workflows.createWorkflow({ name, description: null, providerId: null }));
  okOrThrow(database.workflows.replaceGraph(workflow.id, nodes, edges));
  return workflow.id;
}

function handleOf(supervisor: RunSupervisor, runId: string): ActiveRunHandle {
  const handle = supervisor.getActiveRun(runId);
  if (handle === undefined) {
    throw new Error(`a(z) ${runId} futáshoz nincs aktív kézikönyv`);
  }
  return handle;
}

/**
 * Egy futás elindítása és a terminális állapotának megvárása. A kézikönyvet a
 * `startRun` visszatérése UTÁN, még szinkron módon vesszük ki, mert a
 * nyilvántartás a futás lezárultakor kiürül.
 */
async function runToEnd(
  harness: Harness,
  workflowId: string,
  input: Readonly<Record<string, unknown>> = {},
): Promise<string> {
  const started = okOrThrow(harness.supervisor.startRun({ workflowId, input }));
  const handle = handleOf(harness.supervisor, started.run.id);
  okOrThrow(await handle.completion);
  return started.run.id;
}

/**
 * Megvárja, amíg egy `human_approval` lépés jóváhagyási kérése megjelenik.
 * Csak mikrotaszkot ürít: a motor tesztjeiben nincs valós idő (SPEC-004 14.2).
 */
async function waitForPendingApproval(database: DatabaseContext): Promise<string> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const [pending] = okOrThrow(database.approvals.listPendingApprovals());
    if (pending !== undefined) {
      return pending.stepRunId;
    }
    await Promise.resolve();
  }
  throw new Error('nem érkezett jóváhagyási kérés');
}

/**
 * A jövőbeli `decideApproval` motor művelet (T-005-28) helyettesítése a
 * tesztben: a `db` tranzakció UTÁN értesíti a regisztert, pontosan abban a
 * sorrendben, ahogy a valós hívónak is kell majd.
 */
async function decideAndRun(harness: Harness, workflowId: string, decision: 'approved' | 'rejected'): Promise<string> {
  const started = okOrThrow(harness.supervisor.startRun({ workflowId, input: {} }));
  const handle = handleOf(harness.supervisor, started.run.id);
  const stepRunId = await waitForPendingApproval(harness.database);
  okOrThrow(harness.database.approvals.decideApproval({ stepRunId, decision }));
  harness.approvalRegistry.notifyDecided(stepRunId, decision);
  okOrThrow(await handle.completion);
  return started.run.id;
}

function stepRunsOf(database: DatabaseContext, runId: string): readonly StepRunRecord[] {
  return okOrThrow(database.stepRuns.listStepRuns(runId));
}
function statusOf(database: DatabaseContext, runId: string): string {
  return okOrThrow(database.runs.getRun(runId)).status;
}

function eventKinds(database: DatabaseContext, runId: string): readonly string[] {
  return okOrThrow(database.events.readEventsSince(runId, 0, 500)).map((event) => event.kind);
}

describe('createRunSupervisor', () => {
  describe('a futás indításának menete (SPEC-004 4.8)', () => {
    it('lineáris láncot végigfuttat, és a futás succeeded állapotban zár', async () => {
      const harness = openHarness();
      const workflowId = createWorkflow(
        harness.database,
        'lineáris',
        [startNode('start'), agentNode('a1', 'sikeres'), agentNode('a2', 'sikeres')],
        [edgeOf('e1', 'start', 'a1'), edgeOf('e2', 'a1', 'a2')],
      );

      const runId = await runToEnd(harness, workflowId);

      expect(statusOf(harness.database, runId)).toBe('succeeded');
      expect(stepRunsOf(harness.database, runId).map((row) => row.nodeId)).toStrictEqual(['start', 'a1', 'a2']);
      expect(stepRunsOf(harness.database, runId).every((row) => row.status === 'succeeded')).toBe(true);
    });

    it('a futás bemenete a start node kimenete, és a lépés sorai megkapják az SDK session azonosítót', async () => {
      const harness = openHarness();
      const workflowId = createWorkflow(
        harness.database,
        'bemenet',
        [startNode('start', ['tema']), agentNode('a1', 'sikeres')],
        [edgeOf('e1', 'start', 'a1')],
      );

      const runId = await runToEnd(harness, workflowId, { tema: 'nyuszi' });

      const [startRun, agentRun] = stepRunsOf(harness.database, runId);
      expect(startRun?.output).toStrictEqual({ tema: 'nyuszi' });
      expect(agentRun?.sdkSessionId).not.toBeNull();
    });

    it('a run_started eseményt a db írja, a motor csak az élő nézetnek adja ki, egyetlen sorral', async () => {
      const harness = openHarness();
      const workflowId = createWorkflow(
        harness.database,
        'esemény',
        [startNode('start'), agentNode('a1', 'sikeres')],
        [edgeOf('e1', 'start', 'a1')],
      );

      const runId = await runToEnd(harness, workflowId);

      const kinds = eventKinds(harness.database, runId);
      expect(kinds.filter((kind) => kind === 'run_started')).toHaveLength(1);
      expect(kinds.filter((kind) => kind === 'run_finished')).toHaveLength(1);
      expect(harness.published.filter((event) => isFixtureRoot(event) && event['kind'] === 'run_started')).toHaveLength(
        1,
      );
    });
  });

  describe('érvénytelen futás: egyetlen adat sem íródik (4.8 zárómondata)', () => {
    it('nem létező workflow esetén nem jön létre workflow_run sor', () => {
      const harness = openHarness();

      const outcome = harness.supervisor.startRun({ workflowId: 'nincs-ilyen', input: {} });

      expect(outcome.kind).toBe('error');
      expect(okOrThrow(harness.database.runs.listRuns())).toStrictEqual([]);
    });

    it('érvénytelen gráf (script node) esetén nem jön létre workflow_run sor', () => {
      const harness = openHarness();
      const workflowId = createWorkflow(
        harness.database,
        'script',
        [
          startNode('start'),
          nodeOf('sc', { type: 'script', source: 'x', runtime: 'expression', onUnhandledError: 'fail_run' }),
        ],
        [edgeOf('e1', 'start', 'sc')],
      );

      const outcome = harness.supervisor.startRun({ workflowId, input: {} });

      expect(outcome.kind === 'error' ? outcome.message : '').toContain('unimplemented_node_type');
      expect(okOrThrow(harness.database.runs.listRuns())).toStrictEqual([]);
    });

    it('hiányzó kötelező bemenet esetén nem jön létre workflow_run sor', () => {
      const harness = openHarness();
      const workflowId = createWorkflow(
        harness.database,
        'bemenet',
        [startNode('start', ['tema']), agentNode('a1', 'sikeres')],
        [edgeOf('e1', 'start', 'a1')],
      );

      const outcome = harness.supervisor.startRun({ workflowId, input: {} });

      expect(outcome.kind === 'error' ? outcome.message : '').toContain('missing_required_input');
      expect(okOrThrow(harness.database.runs.listRuns())).toStrictEqual([]);
    });

    it('hiányzó globális alapértelmezett provider esetén nem jön létre workflow_run sor', () => {
      const harness = openHarness({ withoutDefaultProvider: true });
      const workflowId = createWorkflow(
        harness.database,
        'provider',
        [startNode('start'), agentNode('a1', 'sikeres')],
        [edgeOf('e1', 'start', 'a1')],
      );

      const outcome = harness.supervisor.startRun({ workflowId, input: {} });

      expect(outcome.kind === 'error' ? outcome.message : '').toContain('no_default_provider');
      expect(okOrThrow(harness.database.runs.listRuns())).toStrictEqual([]);
    });

    it('a leíró és a telepített SDK verzió eltérése esetén nem jön létre workflow_run sor', () => {
      const harness = openHarness({
        descriptorLookup: (providerId) => ({ ...descriptorOf(providerId), sdkVersionPin: '9.9.9-masik' }),
      });
      const workflowId = createWorkflow(
        harness.database,
        'sdk',
        [startNode('start'), agentNode('a1', 'sikeres')],
        [edgeOf('e1', 'start', 'a1')],
      );

      const outcome = harness.supervisor.startRun({ workflowId, input: {} });

      expect(outcome.kind === 'error' ? outcome.message : '').toContain('provider_descriptor_sdk_mismatch');
      expect(okOrThrow(harness.database.runs.listRuns())).toStrictEqual([]);
    });
  });

  describe('a gráf alakjai (4.4 ... 4.6)', () => {
    it('branch: csak a választott ág fut le, a másik ág step_run sor nélkül marad', async () => {
      const harness = openHarness();
      const workflowId = createWorkflow(
        harness.database,
        'branch',
        [
          startNode('start'),
          branchNode('br', '"bal"', ['bal', 'jobb']),
          agentNode('bal', 'sikeres'),
          agentNode('jobb', 'sikeres'),
        ],
        [edgeOf('e1', 'start', 'br'), edgeOf('e2', 'br', 'bal', 'bal'), edgeOf('e3', 'br', 'jobb', 'jobb')],
      );

      const runId = await runToEnd(harness, workflowId);

      expect(statusOf(harness.database, runId)).toBe('succeeded');
      expect(stepRunsOf(harness.database, runId).map((row) => row.nodeId)).toStrictEqual(['start', 'br', 'bal']);
    });

    it('fan_out + join: N elem N példányt indít, a join egyszer fut le N bemenettel', async () => {
      const harness = openHarness();
      const workflowId = createWorkflow(
        harness.database,
        'fan-out',
        [startNode('start'), fanOutNode('fo', '[1,2]'), agentNode('elem', 'sikeres'), joinMergeNode('j')],
        [edgeOf('e1', 'start', 'fo'), edgeOf('e2', 'fo', 'elem'), edgeOf('e3', 'elem', 'j')],
      );

      const runId = await runToEnd(harness, workflowId);

      const rows = stepRunsOf(harness.database, runId);
      expect(rows.filter((row) => row.nodeId === 'elem')).toHaveLength(2);
      const joinRows = rows.filter((row) => row.nodeId === 'j');
      expect(joinRows).toHaveLength(1);
      const joinOutput = joinRows[0]?.output;
      expect(isUnknownArray(joinOutput) ? joinOutput.length : -1).toBe(2);
      expect(statusOf(harness.database, runId)).toBe('succeeded');
    });

    it('loop: a törzs iterációnként fut, a kilépő ág a ciklus után folytatja', async () => {
      const harness = openHarness();
      const workflowId = createWorkflow(
        harness.database,
        'loop',
        [
          startNode('start'),
          loopNode('lp', 'MEG-EGYSZER', 5),
          agentNode('torzs', 'sikeres'),
          agentNode('vege', 'sikeres'),
        ],
        [
          edgeOf('e1', 'start', 'lp'),
          edgeOf('e2', 'lp', 'torzs', 'continue'),
          edgeOf('e3', 'torzs', 'lp'),
          edgeOf('e4', 'lp', 'vege', 'exit'),
        ],
      );

      const runId = await runToEnd(harness, workflowId);

      const rows = stepRunsOf(harness.database, runId);
      expect(rows.filter((row) => row.nodeId === 'lp')).toHaveLength(2);
      expect(rows.filter((row) => row.nodeId === 'torzs')).toHaveLength(1);
      expect(rows.filter((row) => row.nodeId === 'vege')).toHaveLength(1);
      expect(statusOf(harness.database, runId)).toBe('succeeded');
    });
  });

  describe('hibakezelés (8.1 ... 8.4)', () => {
    it('fail_run: a kezeletlen hiba után nem indul új lépés, és a futás failed állapotban zár', async () => {
      const harness = openHarness();
      const workflowId = createWorkflow(
        harness.database,
        'fail-run',
        [
          startNode('start'),
          agentNode('hibas', 'hibasSubtype', 'fail_run'),
          agentNode('ok1', 'sikeres'),
          agentNode('ok2', 'sikeres'),
        ],
        [edgeOf('e1', 'start', 'hibas'), edgeOf('e2', 'start', 'ok1'), edgeOf('e3', 'ok1', 'ok2')],
      );

      const runId = await runToEnd(harness, workflowId);

      const run = okOrThrow(harness.database.runs.getRun(runId));
      expect(run.status).toBe('failed');
      expect(run.errorKind).toBe('agent_result_not_success');
      const nodeIds = stepRunsOf(harness.database, runId).map((row) => row.nodeId);
      expect(nodeIds).toContain('ok1');
      expect(nodeIds).not.toContain('ok2');
    });

    it('fail_branch: a testvér ág végigfut, a futás mégis failed állapotban zár, az ELSŐ hiba osztályával', async () => {
      const harness = openHarness();
      const workflowId = createWorkflow(
        harness.database,
        'fail-branch',
        [
          startNode('start'),
          agentNode('hibas', 'hibasSubtype', 'fail_branch'),
          agentNode('ok1', 'sikeres'),
          agentNode('ok2', 'sikeres'),
        ],
        [edgeOf('e1', 'start', 'hibas'), edgeOf('e2', 'start', 'ok1'), edgeOf('e3', 'ok1', 'ok2')],
      );

      const runId = await runToEnd(harness, workflowId);

      const run = okOrThrow(harness.database.runs.getRun(runId));
      expect(run.status).toBe('failed');
      expect(run.errorKind).toBe('agent_result_not_success');
      expect(run.errorMessage).toContain('elhalt ágak száma: 1');
      const rows = stepRunsOf(harness.database, runId);
      expect(rows.filter((row) => row.nodeId === 'ok2' && row.status === 'succeeded')).toHaveLength(1);
    });

    it('error_handler: az újrapróbálkozás pontosan EGY új step_run sort hoz létre attempt + 1 értékkel', async () => {
      const harness = openHarness();
      const workflowId = createWorkflow(
        harness.database,
        'retry',
        [
          startNode('start'),
          agentNode('a1', 'ELOSZOR-HIBA'),
          errorHandlerNode('eh', 2, [7]),
          agentNode('a2', 'sikeres'),
        ],
        [edgeOf('e1', 'start', 'a1'), edgeOf('e2', 'a1', 'eh', 'on_error'), edgeOf('e3', 'a1', 'a2')],
      );

      const runId = await runToEnd(harness, workflowId);

      const rows = stepRunsOf(harness.database, runId);
      const attempts = rows.filter((row) => row.nodeId === 'a1');
      expect(attempts.map((row) => `${String(row.attempt)}:${row.status}`)).toStrictEqual(['1:failed', '2:succeeded']);
      expect(rows.filter((row) => row.nodeId === 'eh' && row.status === 'succeeded')).toHaveLength(1);
      expect(rows.filter((row) => row.nodeId === 'a2' && row.status === 'succeeded')).toHaveLength(1);
      expect(harness.sleepCalls).toStrictEqual([{ ms: 7 }]);
      expect(statusOf(harness.database, runId)).toBe('succeeded');
    });

    it('error_handler: a kísérletek elfogyása után exhausted él híján a politika dönt, a futás failed', async () => {
      const harness = openHarness();
      const workflowId = createWorkflow(
        harness.database,
        'retry-exhausted',
        [startNode('start'), agentNode('a1', 'hibasSubtype'), errorHandlerNode('eh', 1, [])],
        [edgeOf('e1', 'start', 'a1'), edgeOf('e2', 'a1', 'eh', 'on_error')],
      );

      const runId = await runToEnd(harness, workflowId);

      const run = okOrThrow(harness.database.runs.getRun(runId));
      expect(run.status).toBe('failed');
      expect(run.errorKind).toBe('retry_attempts_exhausted');
      expect(harness.sleepCalls).toStrictEqual([]);
    });

    it('error_handler: kimerült kísérletek után az exhausted él viszi tovább a vezérlést', async () => {
      const harness = openHarness();
      const workflowId = createWorkflow(
        harness.database,
        'exhausted-el',
        [
          startNode('start'),
          agentNode('a1', 'hibasSubtype'),
          errorHandlerNode('eh', 1, []),
          agentNode('mentes', 'sikeres'),
        ],
        [edgeOf('e1', 'start', 'a1'), edgeOf('e2', 'a1', 'eh', 'on_error'), edgeOf('e3', 'eh', 'mentes', 'exhausted')],
      );

      const runId = await runToEnd(harness, workflowId);

      const rows = stepRunsOf(harness.database, runId);
      expect(rows.filter((row) => row.nodeId === 'mentes' && row.status === 'succeeded')).toHaveLength(1);
      expect(statusOf(harness.database, runId)).toBe('succeeded');
    });
  });

  describe('human_approval (5.8)', () => {
    it('lejáró időkorlát: approval_timed_out, és a politika szerint a futás failed', async () => {
      const harness = openHarness();
      const workflowId = createWorkflow(
        harness.database,
        'jovahagyas-lejar',
        [startNode('start'), approvalNode('jov', 5), agentNode('utana', 'sikeres')],
        [edgeOf('e1', 'start', 'jov'), edgeOf('e2', 'jov', 'utana', 'approved')],
      );

      const runId = await runToEnd(harness, workflowId);

      const run = okOrThrow(harness.database.runs.getRun(runId));
      expect(run.status).toBe('failed');
      expect(run.errorKind).toBe('approval_timed_out');
      expect(harness.sleepCalls).toStrictEqual([{ ms: 5 }]);
    });

    it('jóváhagyás: a vezérlés az approved élre megy, a futás succeeded', async () => {
      const harness = openHarness();
      const workflowId = createWorkflow(
        harness.database,
        'jovahagyas-igen',
        [startNode('start'), approvalNode('jov', null), agentNode('utana', 'sikeres')],
        [edgeOf('e1', 'start', 'jov'), edgeOf('e2', 'jov', 'utana', 'approved')],
      );

      const runId = await decideAndRun(harness, workflowId, 'approved');

      const rows = stepRunsOf(harness.database, runId);
      expect(rows.filter((row) => row.nodeId === 'utana' && row.status === 'succeeded')).toHaveLength(1);
      expect(statusOf(harness.database, runId)).toBe('succeeded');
    });

    it('elutasítás rejected él nélkül: a 8.3 politika dönt, approval_rejected osztállyal', async () => {
      const harness = openHarness();
      const workflowId = createWorkflow(
        harness.database,
        'jovahagyas-nem',
        [startNode('start'), approvalNode('jov', null), agentNode('utana', 'sikeres')],
        [edgeOf('e1', 'start', 'jov'), edgeOf('e2', 'jov', 'utana', 'approved')],
      );

      const runId = await decideAndRun(harness, workflowId, 'rejected');

      const run = okOrThrow(harness.database.runs.getRun(runId));
      expect(run.status).toBe('failed');
      expect(run.errorKind).toBe('approval_rejected');
      expect(stepRunsOf(harness.database, runId).map((row) => row.nodeId)).toStrictEqual(['start', 'jov']);
    });

    it('elutasítás rejected éllel: a vezérlés arra megy, és a futás succeeded', async () => {
      const harness = openHarness();
      const workflowId = createWorkflow(
        harness.database,
        'jovahagyas-nem-el',
        [startNode('start'), approvalNode('jov', null), agentNode('igen', 'sikeres'), agentNode('nem', 'sikeres')],
        [edgeOf('e1', 'start', 'jov'), edgeOf('e2', 'jov', 'igen', 'approved'), edgeOf('e3', 'jov', 'nem', 'rejected')],
      );

      const runId = await decideAndRun(harness, workflowId, 'rejected');

      const rows = stepRunsOf(harness.database, runId);
      expect(rows.filter((row) => row.nodeId === 'nem' && row.status === 'succeeded')).toHaveLength(1);
      expect(rows.filter((row) => row.nodeId === 'igen')).toHaveLength(0);
      expect(statusOf(harness.database, runId)).toBe('succeeded');
    });
  });

  describe('al-workflow (5.9) és a ChildWorkflowRunner', () => {
    it('a gyerek futás lefut, és a szülő lépés kimenete a gyerek terminális node-jának kimenete', async () => {
      const harness = openHarness();
      const childId = createWorkflow(
        harness.database,
        'gyerek',
        [startNode('gy-start'), agentNode('gy-ac', 'sikeres')],
        [edgeOf('gy-e1', 'gy-start', 'gy-ac')],
      );
      const parentId = createWorkflow(
        harness.database,
        'szulo',
        [startNode('sz-start'), subWorkflowNode('sz-sw', childId)],
        [edgeOf('sz-e1', 'sz-start', 'sz-sw')],
      );

      const runId = await runToEnd(harness, parentId);

      const parentRows = stepRunsOf(harness.database, runId);
      const subRow = parentRows.find((row) => row.nodeId === 'sz-sw');
      expect(subRow?.status).toBe('succeeded');
      expect(subRow?.subWorkflowRunId).not.toBeNull();
      const childRun = okOrThrow(harness.database.runs.getRun(String(subRow?.subWorkflowRunId)));
      expect(childRun.status).toBe('succeeded');
      expect(childRun.depth).toBe(1);
      expect(childRun.rootRunId).toBe(runId);
      expect(statusOf(harness.database, runId)).toBe('succeeded');
    });

    it('érvénytelen gyerek workflow esetén a szülő lépés sub_workflow_failed osztállyal bukik', async () => {
      const harness = openHarness();
      const childId = createWorkflow(
        harness.database,
        'gyerek-hianyos',
        [startNode('gy-start', ['kotelezo']), agentNode('gy-ac', 'sikeres')],
        [edgeOf('gy-e1', 'gy-start', 'gy-ac')],
      );
      const parentId = createWorkflow(
        harness.database,
        'szulo-hibas',
        [startNode('sz-start'), subWorkflowNode('sz-sw', childId)],
        [edgeOf('sz-e1', 'sz-start', 'sz-sw')],
      );

      const runId = await runToEnd(harness, parentId);

      const subRow = stepRunsOf(harness.database, runId).find((row) => row.nodeId === 'sz-sw');
      expect(subRow?.status).toBe('failed');
      expect(subRow?.errorKind).toBe('sub_workflow_failed');
      expect(okOrThrow(harness.database.runs.listRuns())).toHaveLength(1);
    });

    it('ismeretlen gyerek futás megvárása hibaág, sub_workflow_failed osztállyal', async () => {
      const harness = openHarness();

      const outcome = await harness.supervisor.awaitChildRun('nincs-ilyen-futas');

      expect(outcome.kind === 'error' ? outcome.message : '').toContain('sub_workflow_failed');
    });
  });

  describe('az aktív futások nyilvántartása (a T-005-26 és a T-005-28 felülete)', () => {
    it('a futás alatt elérhető a kézikönyv, a lezárás után kiesik a nyilvántartásból', async () => {
      const harness = openHarness();
      const workflowId = createWorkflow(
        harness.database,
        'nyilvantartas',
        [startNode('start'), approvalNode('jov', null)],
        [edgeOf('e1', 'start', 'jov')],
      );

      const started = okOrThrow(harness.supervisor.startRun({ workflowId, input: {} }));
      const handle = handleOf(harness.supervisor, started.run.id);
      expect(handle.rootRunId).toBe(started.run.id);
      expect(handle.workflowId).toBe(workflowId);
      expect(harness.supervisor.listActiveRuns()).toHaveLength(1);
      expect(handle.isStopRequested()).toBe(false);

      const stepRunId = await waitForPendingApproval(harness.database);
      okOrThrow(harness.database.approvals.decideApproval({ stepRunId, decision: 'approved' }));
      harness.approvalRegistry.notifyDecided(stepRunId, 'approved');
      okOrThrow(await handle.completion);

      expect(harness.supervisor.getActiveRun(started.run.id)).toBeUndefined();
      expect(harness.supervisor.listActiveRuns()).toStrictEqual([]);
    });

    it('requestStop után nem indul új lépés, és a záró állapotot a leállítást kérő írja', async () => {
      const harness = openHarness();
      const workflowId = createWorkflow(
        harness.database,
        'leallitas',
        [startNode('start'), approvalNode('jov', null), agentNode('utana', 'sikeres')],
        [edgeOf('e1', 'start', 'jov'), edgeOf('e2', 'jov', 'utana', 'approved')],
      );

      const started = okOrThrow(harness.supervisor.startRun({ workflowId, input: {} }));
      const handle = handleOf(harness.supervisor, started.run.id);
      const stepRunId = await waitForPendingApproval(harness.database);
      handle.requestStop();
      okOrThrow(harness.database.approvals.decideApproval({ stepRunId, decision: 'approved' }));
      harness.approvalRegistry.notifyDecided(stepRunId, 'approved');
      okOrThrow(await handle.completion);

      expect(handle.isStopRequested()).toBe(true);
      expect(statusOf(harness.database, started.run.id)).toBe('running');
      expect(stepRunsOf(harness.database, started.run.id).map((row) => row.nodeId)).toStrictEqual(['start', 'jov']);
    });
  });

  describe('adatbázis hiba a futás indításának írási szakaszában', () => {
    it('a startRun hibája nem hagy futó futást, és hibaágon tér vissza', () => {
      const harness = openHarness({
        descriptorLookup: (providerId) => {
          harness.database.close();
          return descriptorOf(providerId);
        },
      });
      const workflowId = createWorkflow(
        harness.database,
        'db-hiba-start',
        [startNode('start'), agentNode('a1', 'sikeres')],
        [edgeOf('e1', 'start', 'a1')],
      );

      const outcome = harness.supervisor.startRun({ workflowId, input: {} });

      expect(outcome.kind).toBe('error');
    });

    it('a markRunRunning hibája hibaágon tér vissza', () => {
      const harness = openHarness({
        onPublish: (event) => {
          if (isFixtureRoot(event) && event['kind'] === 'run_started') {
            harness.database.close();
          }
        },
      });
      const workflowId = createWorkflow(
        harness.database,
        'db-hiba-running',
        [startNode('start'), agentNode('a1', 'sikeres')],
        [edgeOf('e1', 'start', 'a1')],
      );

      const outcome = harness.supervisor.startRun({ workflowId, input: {} });

      expect(outcome.kind).toBe('error');
    });
  });
});
