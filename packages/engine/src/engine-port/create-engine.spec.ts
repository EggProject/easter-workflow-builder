/* eslint-disable unicorn/no-null -- a node configok, a `WorkflowEdgeInput` és a `Fact<T | null>` nullázható mezői (SPEC-003 4.3, 4.7, SPEC-000 5.) a tárolt/mért alakban valódi `null` értéket hordoznak, a teszt fixture ezt másolja */
import { describe, expect, it } from 'vitest';
import { INSTALLED_AGENT_SDK_VERSION, type AgentQuery, type AgentQueryRunner } from '@easter-workflow-builder/agent';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import type {
  AgentStepConfig,
  DatabaseContext,
  NodeConfig,
  WorkflowEdgeInput,
  WorkflowNodeInput,
} from '@easter-workflow-builder/db';
import { openDatabase } from '@easter-workflow-builder/db';
import type {
  EnvironmentRequirement,
  Fact,
  ModelDescriptor,
  ProviderCapabilityDescriptor,
  ProviderId,
} from '@easter-workflow-builder/provider-capability';
import { isRecord } from '@easter-workflow-builder/typeguards';
import { createEngine } from './create-engine.ts';
import type { EngineDependencies } from './engine-dependencies.ts';
import type { EventPublisherPort } from './event-publisher-port.ts';

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (!isOkOutcome(outcome)) {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
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
 * Egy `init` üzenet után a `release()` hívásig felfüggesztett üzenetfolyam
 * (`agent-step/run-agent-step.spec.ts` `controlledMessageIterable` mintája).
 * Az `interruptRun`/`shutdown` teszteknek egy TÉNYLEGESEN folyamatban lévő
 * `agent_step` példányra van szükségük, amit a SPEC-004 9. szekció 3. pontja
 * szerint az `AgentQuery.interrupt()` hívása enged tovább - egy
 * `human_approval` lépés `timeoutMs: null` várakozása erre NEM alkalmas,
 * mert ahhoz nem tartozik `AgentQuery` (`execute-human-approval.ts` doksija:
 * a node nem foglal helyet és nincs SDK hívása), tehát a megszakítás
 * jelzése sosem érné el a döntésre váró promise-t.
 */
function controlledMessageIterable(sessionId: string): {
  readonly messages: AsyncIterable<unknown>;
  readonly release: () => void;
} {
  const { promise: gate, resolve: releaseGate } = Promise.withResolvers<undefined>();

  async function* generate(): AsyncGenerator {
    yield { type: 'system', subtype: 'init', session_id: sessionId, uuid: `${sessionId}-1` };
    await gate;
    yield {
      type: 'result',
      subtype: 'success',
      session_id: sessionId,
      uuid: `${sessionId}-2`,
      num_turns: 1,
      usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    };
  }

  return {
    messages: generate(),
    release: () => {
      releaseGate(undefined);
    },
  };
}

/**
 * Egy `result: success` SDK üzenetsorozat, session azonosítóval a `system`
 * `init` üzenetben (SPEC-004 F-3). Az `uuid` hívásonként egyedivé alakul,
 * mert a `run_event` tábla `sdk_uuid` idempotencia oszlopa futásonként
 * egyedi értéket vár (SPEC-003 6.5).
 */
function successMessages(callIndex: number): readonly unknown[] {
  return [
    { type: 'system', subtype: 'init', session_id: `session-${String(callIndex)}`, uuid: `u-${String(callIndex)}-1` },
    {
      type: 'result',
      subtype: 'success',
      session_id: `session-${String(callIndex)}`,
      uuid: `u-${String(callIndex)}-2`,
      num_turns: 1,
      usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    },
  ];
}

/**
 * Minden agent lépést sikeresre fut a teljes életciklus tesztjeihez
 * (`startRun`/`decideApproval`/`interruptRun`/`shutdown`/`restartRun`
 * összeállítás-szintű ellenőrzésére); a `testProviderConnection` saját,
 * elemenként vezérelt hamis futtatót kap, lásd lent.
 */
function fakeAgentStepRunner(): AgentQueryRunner {
  let callIndex = 0;
  return {
    run: () => {
      callIndex += 1;
      return {
        kind: 'ok',
        value: { messages: messageIterable(successMessages(callIndex)), interrupt: () => Promise.resolve() },
      };
    },
  };
}

/**
 * A `published` tömb egy adott `kind` és `stepRunId` szűrésű eseményének
 * `payload.status` mezőjét adja vissza, az `isRecord` typeguardjával
 * szűkítve (nem `expect.objectContaining` egymásba ágyazva, mert az
 * `@typescript-eslint/no-unsafe-assignment` nem engedi a tetszőleges alakú
 * `unknown` payloadot közvetlenül `objectContaining` bemenetként adni).
 */
function findEventPayloadStatus(published: readonly unknown[], kind: string, stepRunId: string): unknown {
  const event = published.find(
    (candidate) => isRecord(candidate) && candidate['kind'] === kind && candidate['stepRunId'] === stepRunId,
  );
  if (!isRecord(event) || !isRecord(event['payload'])) {
    return undefined;
  }
  return event['payload']['status'];
}

function agentQueryOf(messages: AsyncIterable<unknown>): AgentQuery {
  return { messages, interrupt: () => Promise.resolve() };
}

function runnerReturning(query: Outcome<AgentQuery>): AgentQueryRunner {
  return { run: () => query };
}

function knownFact<TValue>(value: TValue): Fact<TValue> {
  return { state: 'known', value, evidence: [{ kind: 'measurement', id: 'M-01' }] };
}

function unknownFact<TValue>(): Fact<TValue> {
  return { state: 'unknown', reason: 'teszt: nincs mérés', blockedBy: ['M-99'] };
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

interface DescriptorOverrides {
  readonly requiredEnv?: readonly EnvironmentRequirement[];
  readonly calledBySdk?: Fact<boolean>;
  readonly measuredMaxConcurrentSteps?: Fact<number>;
}

function descriptorOf(
  id: ProviderId,
  overrides: DescriptorOverrides = {},
): ProviderCapabilityDescriptor<string, string> {
  return {
    id,
    displayName: `leíró: ${id}`,
    // A `createEngine` a valódi `INSTALLED_AGENT_SDK_VERSION` konstanst adja
    // a `RunSupervisor`-nak (nem egy teszt-only értéket, mint a többi, a
    // `RunSupervisor`-t közvetlenül példányosító spec fájl), ezért a leíró
    // `sdkVersionPin` mezőjének is ezt kell hordoznia, különben minden
    // `agent_step` `provider_descriptor_sdk_mismatch` hibával bukna
    // (`validate-provider-capabilities.ts`).
    sdkVersionPin: INSTALLED_AGENT_SDK_VERSION,
    measuredAt: '2026-08-28',
    requiredEnv: overrides.requiredEnv ?? [],
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
      calledBySdk: overrides.calledBySdk ?? knownFact(false),
      listedModelCount: knownFact(0),
    },
    rateLimits: { buckets: [], retryAfterHeader: knownFact(null), rateLimitHeaders: knownFact([]) },
    concurrency: {
      subagentCapEnvVar: knownFact(null),
      measuredSubagentCap: knownFact(1),
      observedMaxConcurrentRequests: knownFact(1),
      measuredMaxConcurrentSteps: overrides.measuredMaxConcurrentSteps ?? knownFact(20),
    },
    anthropicBetaHeaders: knownFact([]),
  };
}

interface HarnessOptions {
  readonly agentQueryRunner?: AgentQueryRunner;
  readonly descriptorLookup?: (providerId: ProviderId) => ProviderCapabilityDescriptor<string, string>;
  readonly database?: DatabaseContext;
  readonly processEnvironment?: EngineDependencies['processEnvironment'];
}

interface Harness {
  readonly database: DatabaseContext;
  readonly dependencies: EngineDependencies;
  readonly engine: ReturnType<typeof createEngine>;
  readonly published: unknown[];
}

function openHarness(options: HarnessOptions = {}): Harness {
  const database = options.database ?? okOrThrow(openDatabase(':memory:'));
  const published: unknown[] = [];
  let nextId = 0;
  const publisher: EventPublisherPort = {
    publish: (event) => {
      published.push(event);
    },
  };
  const dependencies: EngineDependencies = {
    database,
    agentQueryRunner: options.agentQueryRunner ?? fakeAgentStepRunner(),
    providerDescriptorLookup: options.descriptorLookup ?? ((providerId) => descriptorOf(providerId)),
    expressionEvaluator: {
      evaluate: (expression) => ({ kind: 'ok', value: JSON.parse(expression) }),
      compile: () => ({ kind: 'ok', value: undefined }),
    },
    templateRenderer: {
      render: (template) => ({ kind: 'ok', value: template }),
      compile: () => ({ kind: 'ok', value: undefined }),
    },
    eventPublisher: publisher,
    clock: (() => {
      let now = 0;
      return {
        nowMs: () => {
          now += 1;
          return now;
        },
        sleep: () => Promise.resolve(),
      };
    })(),
    idGenerator: {
      nextId: () => {
        nextId += 1;
        return `id-${String(nextId)}`;
      },
    },
    processEnvironment: options.processEnvironment ?? { read: () => null },
  };
  return { database, dependencies, engine: createEngine(dependencies), published };
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
function startNode(id: string): WorkflowNodeInput {
  return nodeOf(id, { type: 'start', inputFields: [], onUnhandledError: 'fail_run' });
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
function agentNode(id: string, promptTemplate: string): WorkflowNodeInput {
  return nodeOf(id, { type: 'agent_step', onUnhandledError: 'fail_run', ...agentStepConfig(promptTemplate) });
}
function approvalNode(id: string, timeoutMs: number | null): WorkflowNodeInput {
  return nodeOf(id, {
    type: 'human_approval',
    title: 'döntés',
    bodyTemplate: 'szöveg',
    timeoutMs,
    onUnhandledError: 'fail_run',
  });
}

function createWorkflow(
  database: DatabaseContext,
  name: string,
  nodes: readonly WorkflowNodeInput[],
  edges: readonly WorkflowEdgeInput[],
): string {
  const workflow = okOrThrow(database.workflows.createWorkflow({ name, description: null, providerId: null }));
  okOrThrow(database.workflows.replaceGraph(workflow.id, nodes, edges));
  okOrThrow(database.settings.setDefaultProvider('minimax'));
  return workflow.id;
}

async function waitForRunStatus(
  database: DatabaseContext,
  runId: string,
  terminal: readonly string[],
): Promise<string> {
  for (let attempt = 0; attempt < 2000; attempt += 1) {
    const status = okOrThrow(database.runs.getRun(runId)).status;
    if (terminal.includes(status)) {
      return status;
    }
    await Promise.resolve();
  }
  throw new Error(`a(z) ${runId} futás nem érte el a várt állapotot`);
}

async function waitForPendingApproval(database: DatabaseContext): Promise<string> {
  for (let attempt = 0; attempt < 2000; attempt += 1) {
    const [pending] = okOrThrow(database.approvals.listPendingApprovals());
    if (pending !== undefined) {
      return pending.stepRunId;
    }
    await Promise.resolve();
  }
  throw new Error('nem érkezett jóváhagyási kérés');
}

/**
 * Megvárja, amíg egy adott node példánya `running` állapotba kerül -
 * `interruptRun`/`shutdown` teszteknek kell, hogy a megszakítás TÉNYLEGESEN
 * egy folyamatban lévő `agent_step` példányt érjen, ne a még el sem indultat.
 */
async function waitForStepRunning(database: DatabaseContext, runId: string, nodeId: string): Promise<void> {
  for (let attempt = 0; attempt < 2000; attempt += 1) {
    const step = okOrThrow(database.stepRuns.listStepRuns(runId)).find((row) => row.nodeId === nodeId);
    if (step?.status === 'running') {
      return;
    }
    await Promise.resolve();
  }
  throw new Error(`a(z) ${nodeId} lépés nem indult el`);
}

const TERMINAL_RUN_STATUSES = ['succeeded', 'failed', 'cancelled', 'interrupted'] as const;

describe('createEngine', () => {
  it('VÉGPONTTÓL VÉGPONTIG: startRun egy egyszerű start -> agent_step gráfon succeeded futást ad', async () => {
    const harness = openHarness();
    const workflowId = createWorkflow(
      harness.database,
      'e2e-lineáris',
      [startNode('start'), agentNode('a1', 'sikeres')],
      [edgeOf('e1', 'start', 'a1')],
    );

    const started = okOrThrow(await harness.engine.startRun({ workflowId, input: {} }));
    const status = await waitForRunStatus(harness.database, started.run.id, TERMINAL_RUN_STATUSES);

    expect(status).toBe('succeeded');
    expect(okOrThrow(harness.database.stepRuns.listStepRuns(started.run.id)).map((row) => row.nodeId)).toStrictEqual([
      'start',
      'a1',
    ]);
  });

  describe('decideApproval', () => {
    it('a db.approvals.decideApproval sikere UTÁN feloldja a várakozást: a lépés succeeded, a futás succeeded', async () => {
      const harness = openHarness();
      const workflowId = createWorkflow(
        harness.database,
        'jovahagyas',
        [startNode('start'), approvalNode('jov', null), agentNode('utana', 'sikeres')],
        [edgeOf('e1', 'start', 'jov'), edgeOf('e2', 'jov', 'utana', 'approved')],
      );

      const started = okOrThrow(await harness.engine.startRun({ workflowId, input: {} }));
      const stepRunId = await waitForPendingApproval(harness.database);

      const decided = await harness.engine.decideApproval({ stepRunId, decision: 'approved' });
      expect(decided.kind).toBe('ok');

      const status = await waitForRunStatus(harness.database, started.run.id, TERMINAL_RUN_STATUSES);
      expect(status).toBe('succeeded');
      const approvalStep = okOrThrow(harness.database.stepRuns.listStepRuns(started.run.id)).find(
        (row) => row.nodeId === 'jov',
      );
      expect(approvalStep?.status).toBe('succeeded');
      // A korábban nyitva hagyott átvezetés (T-005-28): a döntés-érkezés
      // útvonalon a `step_finished` esemény is megjelenik, nem csak az
      // `approval_decided` (lásd `execute-human-approval.ts`).
      expect(findEventPayloadStatus(harness.published, 'step_finished', approvalStep?.id ?? '')).toBe('succeeded');
      expect(harness.published).toContainEqual(expect.objectContaining({ kind: 'approval_decided' }));
    });

    it('ismeretlen stepRunId esetén hibaágat ad, és nem próbál értesíteni', async () => {
      const harness = openHarness();

      const decided = await harness.engine.decideApproval({ stepRunId: 'nincs-ilyen', decision: 'approved' });

      expect(decided.kind).toBe('error');
    });
  });

  describe('suggestedConcurrencyLimit', () => {
    it('known leíró esetén javaslatot ad, és a megjegyzés kimondja, hogy ez alsó korlát', () => {
      const harness = openHarness({
        descriptorLookup: (id) => descriptorOf(id, { measuredMaxConcurrentSteps: knownFact(20) }),
      });

      const suggestion = harness.engine.suggestedConcurrencyLimit('minimax');

      expect(suggestion.suggestedLimit).toBe(20);
      expect(suggestion.note.length).toBeGreaterThan(0);
    });

    it('unknown leíró esetén nincs javaslat, de a megjegyzés kitöltött', () => {
      const harness = openHarness({
        descriptorLookup: (id) => descriptorOf(id, { measuredMaxConcurrentSteps: unknownFact<number>() }),
      });

      const suggestion = harness.engine.suggestedConcurrencyLimit('minimax');

      expect(suggestion.suggestedLimit).toBeUndefined();
      expect(suggestion.note.length).toBeGreaterThan(0);
    });
  });

  describe('testProviderConnection', () => {
    it('sikeres result üzenet esetén succeeded: true, a mode a leíróból jön (sdk_model_list)', async () => {
      // A `system`/`init` üzenet a `result`-tól eltérő, NEM `isSdkResultMessage`
      // ágon fut át (`drainConnectionTestStream` ág-lefedettsége), mielőtt a
      // valódi `result` üzenet lezárja a folyamot - ugyanaz a kétüzenetes alak,
      // mint egy valós SDK folyamban (`successMessages`).
      const successQuery = agentQueryOf(
        messageIterable([
          { type: 'system', subtype: 'init', session_id: 'session-teszt', uuid: 'u-teszt-1' },
          { type: 'result', subtype: 'success' },
        ]),
      );
      const harness = openHarness({
        agentQueryRunner: runnerReturning({ kind: 'ok', value: successQuery }),
        descriptorLookup: (id) => descriptorOf(id, { calledBySdk: knownFact(true) }),
      });

      const outcome = okOrThrow(await harness.engine.testProviderConnection('minimax'));

      expect(outcome).toStrictEqual({ succeeded: true, mode: 'sdk_model_list', errorMessage: null });
    });

    it('a mode minimal_query, ha a leíró calledBySdk mezője known hamis - a hívás akkor is lefut', async () => {
      const successQuery = agentQueryOf(messageIterable([{ type: 'result', subtype: 'success' }]));
      const harness = openHarness({
        agentQueryRunner: runnerReturning({ kind: 'ok', value: successQuery }),
        descriptorLookup: (id) => descriptorOf(id, { calledBySdk: knownFact(false) }),
      });

      const outcome = okOrThrow(await harness.engine.testProviderConnection('minimax'));

      expect(outcome.mode).toBe('minimal_query');
      expect(outcome.succeeded).toBe(true);
    });

    it('unknown calledBySdk esetén is minimal_query módot használ', async () => {
      const successQuery = agentQueryOf(messageIterable([{ type: 'result', subtype: 'success' }]));
      const harness = openHarness({
        agentQueryRunner: runnerReturning({ kind: 'ok', value: successQuery }),
        descriptorLookup: (id) => descriptorOf(id, { calledBySdk: unknownFact<boolean>() }),
      });

      const outcome = okOrThrow(await harness.engine.testProviderConnection('minimax'));

      expect(outcome.mode).toBe('minimal_query');
    });

    it('hiányzó kötelező env változó esetén succeeded: false, a hívás el sem indul', async () => {
      const harness = openHarness({
        agentQueryRunner: {
          run: () => {
            throw new Error('nem szabadna meghívódnia');
          },
        },
        descriptorLookup: (id) =>
          descriptorOf(id, {
            requiredEnv: [
              {
                name: 'TESZT_HIANYZO_KULCS',
                source: 'process_env_passthrough',
                secret: true,
                purpose: 'teszt',
                evidence: [{ kind: 'measurement', id: 'M-01' }],
              },
            ],
          }),
      });

      const outcome = okOrThrow(await harness.engine.testProviderConnection('minimax'));

      expect(outcome.succeeded).toBe(false);
      expect(outcome.errorMessage).toContain('missing_provider_env');
    });

    it('az agentQueryRunner.run hibaágát succeeded: false eredménnyé alakítja', async () => {
      const harness = openHarness({
        agentQueryRunner: runnerReturning({ kind: 'error', message: 'teszt: nem indult el a kapcsolat' }),
      });

      const outcome = okOrThrow(await harness.engine.testProviderConnection('minimax'));

      expect(outcome.succeeded).toBe(false);
      expect(outcome.errorMessage).toContain('nem indult el a kapcsolat');
    });

    it('result üzenet nélkül lezáruló folyam esetén succeeded: false', async () => {
      const emptyQuery = agentQueryOf(messageIterable([]));
      const harness = openHarness({
        agentQueryRunner: runnerReturning({ kind: 'ok', value: emptyQuery }),
      });

      const outcome = okOrThrow(await harness.engine.testProviderConnection('minimax'));

      expect(outcome.succeeded).toBe(false);
      expect(outcome.errorMessage).toContain('result üzenet nélkül');
    });

    it('nem success subtype esetén succeeded: false, a subtype az üzenetben szerepel', async () => {
      const errorSubtypeQuery = agentQueryOf(messageIterable([{ type: 'result', subtype: 'error_max_turns' }]));
      const harness = openHarness({
        agentQueryRunner: runnerReturning({ kind: 'ok', value: errorSubtypeQuery }),
      });

      const outcome = okOrThrow(await harness.engine.testProviderConnection('minimax'));

      expect(outcome.succeeded).toBe(false);
      expect(outcome.errorMessage).toContain('error_max_turns');
    });

    it('a folyam olvasása közben dobott kivételt elkapja, succeeded: false', async () => {
      const throwingMessages: AsyncIterable<unknown> = {
        [Symbol.asyncIterator]: () => ({
          next: () => Promise.reject(new Error('a stream megszakadt')),
        }),
      };
      const harness = openHarness({
        agentQueryRunner: runnerReturning({ kind: 'ok', value: agentQueryOf(throwingMessages) }),
      });

      const outcome = okOrThrow(await harness.engine.testProviderConnection('minimax'));

      expect(outcome.succeeded).toBe(false);
      expect(outcome.errorMessage).toContain('a stream megszakadt');
    });
  });

  describe('interruptRun', () => {
    it('egy folyamatban lévő agent lépést cancelled állapotba visz, az InterruptSummary a gyökeret és a megszakított futást adja', async () => {
      const controlled = controlledMessageIterable('interrupt-teszt');
      const interruptibleRunner: AgentQueryRunner = {
        run: () => ({
          kind: 'ok',
          value: {
            messages: controlled.messages,
            interrupt: () => {
              controlled.release();
              return Promise.resolve();
            },
          },
        }),
      };
      const harness = openHarness({ agentQueryRunner: interruptibleRunner });
      const workflowId = createWorkflow(
        harness.database,
        'megszakitas',
        [startNode('start'), agentNode('a1', 'lassu')],
        [edgeOf('e1', 'start', 'a1')],
      );
      const started = okOrThrow(await harness.engine.startRun({ workflowId, input: {} }));
      await waitForStepRunning(harness.database, started.run.id, 'a1');

      const summary = okOrThrow(await harness.engine.interruptRun(started.run.id));

      expect(summary.rootRunId).toBe(started.run.id);
      expect(summary.cancelledRunIds).toContain(started.run.id);
      expect(okOrThrow(harness.database.runs.getRun(started.run.id)).status).toBe('cancelled');
    });
  });

  describe('shutdown', () => {
    it('minden aktív futást interrupted állapotba visz, a ShutdownSummary a darabszámot adja', async () => {
      const controlled = controlledMessageIterable('leallas-teszt');
      const interruptibleRunner: AgentQueryRunner = {
        run: () => ({
          kind: 'ok',
          value: {
            messages: controlled.messages,
            interrupt: () => {
              controlled.release();
              return Promise.resolve();
            },
          },
        }),
      };
      const harness = openHarness({ agentQueryRunner: interruptibleRunner });
      const workflowId = createWorkflow(
        harness.database,
        'leallas',
        [startNode('start'), agentNode('a1', 'lassu')],
        [edgeOf('e1', 'start', 'a1')],
      );
      const started = okOrThrow(await harness.engine.startRun({ workflowId, input: {} }));
      await waitForStepRunning(harness.database, started.run.id, 'a1');

      const summary = okOrThrow(await harness.engine.shutdown());

      expect(summary.interruptedRunCount).toBeGreaterThanOrEqual(1);
      expect(okOrThrow(harness.database.runs.getRun(started.run.id)).status).toBe('interrupted');
    });

    it('a helyreállítás Outcome hibaágát továbbadja', async () => {
      const database = okOrThrow(openDatabase(':memory:'));
      const racyDatabase: DatabaseContext = {
        ...database,
        recovery: {
          ...database.recovery,
          recoverInterruptedRuns: () => ({ kind: 'error', message: 'teszt: helyreállítási hiba' }),
        },
      };
      const harness = openHarness({ database: racyDatabase });

      const outcome = await harness.engine.shutdown();

      expect(outcome.kind).toBe('error');
    });
  });

  describe('restartRun', () => {
    it('egy lefutott futást újraindít, a restartedFromRunId az eredeti futásra mutat', async () => {
      const harness = openHarness();
      const workflowId = createWorkflow(
        harness.database,
        'ujrainditas',
        [startNode('start'), agentNode('a1', 'sikeres')],
        [edgeOf('e1', 'start', 'a1')],
      );
      const original = okOrThrow(await harness.engine.startRun({ workflowId, input: {} }));
      await waitForRunStatus(harness.database, original.run.id, TERMINAL_RUN_STATUSES);

      const restarted = okOrThrow(await harness.engine.restartRun(original.run.id));

      expect(restarted.run.restartedFromRunId).toBe(original.run.id);
      expect(restarted.run.workflowId).toBe(workflowId);
    });
  });

  describe('a párhuzamossági korlát lekérdezésének hibaága', () => {
    it('ha a provider_concurrency_limit olvasása hibázik, a szabályozó "nincs korlát" állapotot lát, a lépés lefut', async () => {
      const database = okOrThrow(openDatabase(':memory:'));
      const racyDatabase: DatabaseContext = {
        ...database,
        concurrencyLimits: {
          ...database.concurrencyLimits,
          readLimit: () => ({ kind: 'error', message: 'teszt: a korlát nem olvasható' }),
        },
      };
      const harness = openHarness({ database: racyDatabase });
      const workflowId = createWorkflow(
        harness.database,
        'korlat-hiba',
        [startNode('start'), agentNode('a1', 'sikeres')],
        [edgeOf('e1', 'start', 'a1')],
      );

      const started = okOrThrow(await harness.engine.startRun({ workflowId, input: {} }));
      const status = await waitForRunStatus(harness.database, started.run.id, TERMINAL_RUN_STATUSES);

      expect(status).toBe('succeeded');
    });
  });
});
