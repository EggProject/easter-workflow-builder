/* eslint-disable unicorn/no-null -- a node configok, a `WorkflowEdgeInput` és a `Fact<T | null>` nullázható mezői (SPEC-003 4.3, 4.7, SPEC-000 5.) a tárolt/mért alakban valódi `null` értéket hordoznak, a teszt fixture ezt másolja */
import { describe, expect, it } from 'vitest';
import { INSTALLED_AGENT_SDK_VERSION, type AgentQuery, type AgentQueryRunner } from '@easter-workflow-builder/agent';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import type {
  AgentStepConfig,
  DatabaseContext,
  NodeConfig,
  UnhandledErrorPolicy,
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
import { runStartupRecovery } from '../startup-recovery/run-startup-recovery.ts';
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

/**
 * Kiadott-e a motor adott `kind` és `stepRunId` eseményt. A `step_started`
 * payloadjának nincs `status` mezője, ezért annak hiányát nem a
 * `findEventPayloadStatus` `undefined` értéke bizonyítja, hanem ez.
 */
function hasPublishedEvent(published: readonly unknown[], kind: string, stepRunId: string): boolean {
  return published.some(
    (candidate) => isRecord(candidate) && candidate['kind'] === kind && candidate['stepRunId'] === stepRunId,
  );
}

/**
 * Egy hamis agent hívás viselkedése a `scriptedRunner` forgatókönyvében:
 *
 * - `fails_when_released`: az `init` után a `releaseFailure()` hívásig vár,
 *   utána nem sikeres `result` üzenettel zár (`agent_result_not_success`);
 * - `runs_until_interrupt`: magától SOSEM ér véget, csak az `interrupt()`
 *   után, sikeres `result` üzenettel (a megszakított, futó lépés a meglévő
 *   úton, a saját eredménye szerint zár, SPEC-004 9. szekció 4. pont);
 * - `drains_until_released`: az `interrupt()` után sem ér véget, csak a
 *   `releaseDrain()` hívásra, sikeres `result` üzenettel. Ez a leállási ablak:
 *   a folyam kimerülése alatt a futás még nem terminális (SPEC-004 9. szekció
 *   4. pont), és a teszt ebben az ablakban cselekedhet;
 * - `succeeds`: azonnal sikeres.
 */
type ScriptedCall = 'fails_when_released' | 'runs_until_interrupt' | 'drains_until_released' | 'succeeds';

/**
 * Hívásonként előre megírt hamis agent futtató a `fail_run` tesztekhez. A
 * hívások sorrendje a hely kiosztásának sorrendje, nem a node azonosítóé,
 * ezért a forgatókönyv hívás sorszám szerint szól; a forgatókönyvön túli
 * hívás `succeeds`. A számlálók a teszt fő mérőszámai: hány agent hívás
 * történt, és hányszor futott `interrupt()`.
 */
function scriptedRunner(script: readonly ScriptedCall[]): {
  readonly runner: AgentQueryRunner;
  readonly releaseFailure: () => void;
  readonly releaseDrain: () => void;
  readonly calls: { run: number; interrupt: number };
} {
  const { promise: failureGate, resolve: openFailureGate } = Promise.withResolvers<undefined>();
  const { promise: drainGate, resolve: openDrainGate } = Promise.withResolvers<undefined>();
  const calls = { run: 0, interrupt: 0 };

  async function* failingMessages(sessionId: string): AsyncGenerator {
    yield { type: 'system', subtype: 'init', session_id: sessionId, uuid: `${sessionId}-1` };
    await failureGate;
    yield {
      type: 'result',
      subtype: 'error_max_turns',
      session_id: sessionId,
      uuid: `${sessionId}-2`,
      num_turns: 1,
      usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    };
  }

  async function* drainingMessages(sessionId: string): AsyncGenerator {
    yield { type: 'system', subtype: 'init', session_id: sessionId, uuid: `${sessionId}-1` };
    await drainGate;
    yield {
      type: 'result',
      subtype: 'success',
      session_id: sessionId,
      uuid: `${sessionId}-2`,
      num_turns: 1,
      usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    };
  }

  const runner: AgentQueryRunner = {
    run: () => {
      calls.run += 1;
      const sessionId = `hivas-${String(calls.run)}`;
      const behaviour = script[calls.run - 1] ?? 'succeeds';
      if (behaviour === 'succeeds') {
        return {
          kind: 'ok',
          value: { messages: messageIterable(successMessages(calls.run)), interrupt: () => Promise.resolve() },
        };
      }
      if (behaviour === 'drains_until_released') {
        return {
          kind: 'ok',
          value: {
            messages: drainingMessages(sessionId),
            interrupt: () => {
              calls.interrupt += 1;
              return Promise.resolve();
            },
          },
        };
      }
      const controlled = controlledMessageIterable(sessionId);
      return {
        kind: 'ok',
        value: {
          messages: behaviour === 'fails_when_released' ? failingMessages(sessionId) : controlled.messages,
          interrupt: () => {
            calls.interrupt += 1;
            controlled.release();
            return Promise.resolve();
          },
        },
      };
    },
  };
  return {
    runner,
    releaseFailure: () => {
      openFailureGate(undefined);
    },
    releaseDrain: () => {
      openDrainGate(undefined);
    },
    calls,
  };
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
function agentNode(
  id: string,
  promptTemplate: string,
  onUnhandledError: UnhandledErrorPolicy = 'fail_run',
): WorkflowNodeInput {
  return nodeOf(id, { type: 'agent_step', onUnhandledError, ...agentStepConfig(promptTemplate) });
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

// A `runId` megadásával csak az adott futás jóváhagyását várja: két futás
// egyidejű várakozásánál a lista első eleme nem feltétlenül az övé.
async function waitForPendingApproval(database: DatabaseContext, runId?: string): Promise<string> {
  for (let attempt = 0; attempt < 2000; attempt += 1) {
    const pending = okOrThrow(database.approvals.listPendingApprovals()).find(
      (approval) => runId === undefined || approval.runId === runId,
    );
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

/**
 * Megvárja, amíg egy adott node példányának `pending` sora létrejön: a
 * korlátozott szabályozó mellett ez a sorban álló, helyre váró lépés.
 */
async function waitForStepQueued(database: DatabaseContext, runId: string, nodeId: string): Promise<void> {
  for (let attempt = 0; attempt < 2000; attempt += 1) {
    const step = okOrThrow(database.stepRuns.listStepRuns(runId)).find((row) => row.nodeId === nodeId);
    if (step?.status === 'pending') {
      return;
    }
    await Promise.resolve();
  }
  throw new Error(`a(z) ${nodeId} lépés nem állt sorba`);
}

async function waitForStepStatus(
  database: DatabaseContext,
  runId: string,
  nodeId: string,
  status: string,
): Promise<void> {
  for (let attempt = 0; attempt < 2000; attempt += 1) {
    const step = okOrThrow(database.stepRuns.listStepRuns(runId)).find((row) => row.nodeId === nodeId);
    if (step?.status === status) {
      return;
    }
    await Promise.resolve();
  }
  throw new Error(`a(z) ${nodeId} lépés nem érte el a(z) ${status} állapotot`);
}

/**
 * Megvárja, amíg a futás agent lépéseiből pontosan `runningCount` fut és
 * `queuedCount` sorban áll (korlátozott szabályozó mellett), és visszaadja a
 * futó lépések node azonosítóját: a kiosztás sorrendje a futtathatóvá válás
 * sorrendje, amit a teszt nem köt ki.
 */
async function waitForRunningAndQueued(
  database: DatabaseContext,
  runId: string,
  runningCount: number,
  queuedCount: number,
): Promise<readonly string[]> {
  for (let attempt = 0; attempt < 2000; attempt += 1) {
    const agentSteps = okOrThrow(database.stepRuns.listStepRuns(runId)).filter((row) => row.nodeType === 'agent_step');
    const running = agentSteps.filter((row) => row.status === 'running');
    const pendingCount = agentSteps.filter((row) => row.status === 'pending').length;
    if (pendingCount === queuedCount && running.length === runningCount) {
      return running.map((row) => row.nodeId);
    }
    await Promise.resolve();
  }
  throw new Error(
    `a(z) ${runId} futásban nem állt be ${String(runningCount)} futó és ${String(queuedCount)} sorban álló lépés`,
  );
}

/**
 * Megvárja, amíg a hamis futtató `interrupt()` hívásainak száma eléri a
 * `count` értéket. A `fail_run` és a megszakítás a döntésre váró jóváhagyás
 * várakozását ugyanabban a szinkron menetben zárja le, amiben az
 * `interrupt()`-ot hívja, tehát a számláló a leállási ablak kezdetének
 * megfigyelhető jele.
 */
async function waitForInterruptCalls(calls: { readonly interrupt: number }, count: number): Promise<void> {
  for (let attempt = 0; attempt < 2000; attempt += 1) {
    if (calls.interrupt === count) {
      return;
    }
    await Promise.resolve();
  }
  throw new Error(`az interrupt() hívások száma nem érte el a(z) ${String(count)} értéket`);
}

const TERMINAL_RUN_STATUSES = ['succeeded', 'failed', 'cancelled', 'interrupted'] as const;

/**
 * Három párhuzamos agent lépés a `start` után, a `fail_run` tesztekhez.
 * Mindhárom ugyanazzal a politikával, mert a helyet elsőként megkapó (tehát a
 * forgatókönyv első hívását kapó) lépés kiléte a futtathatóvá válás
 * sorrendjén múlik, amit a teszt nem köt ki.
 */
function threeParallelAgentSteps(
  database: DatabaseContext,
  name: string,
  onUnhandledError: UnhandledErrorPolicy,
): string {
  return createWorkflow(
    database,
    name,
    [
      startNode('start'),
      agentNode('a1', 'egy', onUnhandledError),
      agentNode('a2', 'ketto', onUnhandledError),
      agentNode('a3', 'harom', onUnhandledError),
    ],
    [edgeOf('e1', 'start', 'a1'), edgeOf('e2', 'start', 'a2'), edgeOf('e3', 'start', 'a3')],
  );
}

function subWorkflowNode(
  id: string,
  targetWorkflowId: string,
  onUnhandledError: UnhandledErrorPolicy = 'fail_run',
): WorkflowNodeInput {
  return nodeOf(id, { type: 'sub_workflow', targetWorkflowId, inputMapping: {}, onUnhandledError });
}

/**
 * Egy gyerek workflow, aminek egyetlen lépése egy korlátlan várakozású
 * jóváhagyás: a futása magától sosem ér véget, csak döntésre vagy
 * megszakításra.
 */
function waitingChildWorkflow(database: DatabaseContext, name: string, prefix: string): string {
  return createWorkflow(
    database,
    name,
    [startNode(`${prefix}-start`), approvalNode(`${prefix}-jov`, null)],
    [edgeOf(`${prefix}-e1`, `${prefix}-start`, `${prefix}-jov`)],
  );
}

/**
 * Egy gyerek workflow, aminek egyetlen lépése egy agent lépés: a
 * `scriptedRunner` `drains_until_released` hívásával a folyama az `interrupt()`
 * után is a `releaseDrain()` hívásig nyitva marad, tehát a gyerek leállásának
 * vége a teszt kezében van.
 */
function drainingChildWorkflow(database: DatabaseContext, name: string, prefix: string): string {
  return createWorkflow(
    database,
    name,
    [startNode(`${prefix}-start`), agentNode(`${prefix}-agent`, 'gyerek')],
    [edgeOf(`${prefix}-e1`, `${prefix}-start`, `${prefix}-agent`)],
  );
}

/**
 * Megvárja, amíg a futás `sub_workflow` lépésének sora megkapja a gyerek
 * futás azonosítóját (SPEC-004 5.9 3. pont), és visszaadja.
 */
async function waitForChildRunId(database: DatabaseContext, runId: string, nodeId: string): Promise<string> {
  for (let attempt = 0; attempt < 2000; attempt += 1) {
    const childRunId = okOrThrow(database.stepRuns.listStepRuns(runId)).find(
      (row) => row.nodeId === nodeId,
    )?.subWorkflowRunId;
    if (typeof childRunId === 'string') {
      return childRunId;
    }
    await Promise.resolve();
  }
  throw new Error(`a(z) ${nodeId} lépés gyerek futása nem indult el`);
}

// Egy futás élőben kiadott `run_finished` eseményének `payload.status` mezője.
function findRunFinishedStatus(published: readonly unknown[], runId: string): unknown {
  const event = published.find(
    (candidate) => isRecord(candidate) && candidate['kind'] === 'run_finished' && candidate['runId'] === runId,
  );
  if (!isRecord(event) || !isRecord(event['payload'])) {
    return undefined;
  }
  return event['payload']['status'];
}

/**
 * Három szintű fa a `sub_workflow_finished` tesztekhez: a szülő `sub` lépése a
 * gyereket, a gyerek `c-sub` lépése az unokát indítja, az unoka korlátlan
 * várakozású jóváhagyáson áll, tehát a fa magától csak döntésre ér véget. A
 * `siblings` a szülő `start` utáni testvér lépései.
 */
function subWorkflowTree(database: DatabaseContext, siblings: readonly WorkflowNodeInput[]): string {
  const grandchildWorkflowId = waitingChildWorkflow(database, 'unoka', 'u');
  const childWorkflowId = createWorkflow(
    database,
    'gyerek',
    [startNode('c-start'), subWorkflowNode('c-sub', grandchildWorkflowId)],
    [edgeOf('c-e1', 'c-start', 'c-sub')],
  );
  return createWorkflow(
    database,
    'szulo',
    [startNode('start'), subWorkflowNode('sub', childWorkflowId), ...siblings],
    [edgeOf('e-sub', 'start', 'sub'), ...siblings.map((sibling) => edgeOf(`e-${sibling.id}`, 'start', sibling.id))],
  );
}

/**
 * Egy `sub_workflow` lépés zárása, ahogy a `db` őrzi: a lépés végállapota, a
 * `sub_workflow_finished` események `status` mezője, a lépés hibaüzenetében
 * megnevezett gyerek állapot, és a gyerek futás sora a fa zárása után.
 */
function subWorkflowClosingOf(
  database: DatabaseContext,
  runId: string,
  nodeId: string,
): {
  readonly step: readonly unknown[];
  readonly finishedStatuses: readonly unknown[];
  readonly messageStatus: string | undefined;
  readonly childStatus: string;
} {
  const step = okOrThrow(database.stepRuns.listStepRuns(runId)).find((row) => row.nodeId === nodeId);
  if (step?.subWorkflowRunId === undefined || step.subWorkflowRunId === null) {
    throw new Error(`a(z) ${nodeId} lépésnek nincs gyerek futása`);
  }
  const finishedStatuses = okOrThrow(database.events.readEventsForStep(step.id, 100))
    .filter((event) => event.kind === 'sub_workflow_finished')
    .map((event) => (isRecord(event.payload) ? event.payload['status'] : undefined));
  return {
    step: [step.status, step.errorKind],
    finishedStatuses,
    messageStatus: /"(\w+)" állapotban zárt/u.exec(step.errorMessage ?? '')?.[1],
    childStatus: okOrThrow(database.runs.getRun(step.subWorkflowRunId)).status,
  };
}

/**
 * A `subWorkflowTree` gyerekének (a szülő `sub` lépése) és unokájának (a
 * gyerek `c-sub` lépése) zárása egyetlen értékben, hogy egy eltérés mindkét
 * szintet mutassa.
 */
function treeClosingOf(
  database: DatabaseContext,
  rootRunId: string,
  childRunId: string,
): Readonly<Record<'gyerek' | 'unoka', ReturnType<typeof subWorkflowClosingOf>>> {
  return {
    gyerek: subWorkflowClosingOf(database, rootRunId, 'sub'),
    unoka: subWorkflowClosingOf(database, childRunId, 'c-sub'),
  };
}

/**
 * A `treeClosingOf` elvárt értéke, ha a gyerek és az unoka futás `status`
 * állapotban zár: a `sub` lépés `failed`, és az esemény, az üzenet és a sor
 * ugyanazt az állapotot mondja.
 */
function closingFor(status: string): ReturnType<typeof treeClosingOf> {
  const closing = {
    step: ['failed', 'sub_workflow_failed'],
    finishedStatuses: [status],
    messageStatus: status,
    childStatus: status,
  };
  return { gyerek: closing, unoka: closing };
}

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

    it('REGRESSZIÓ: a leállási ablakban (a futó lépés folyamának kimerülése alatt) érkező jóváhagyási döntés illegal_status_transition hibát ad, és semmit nem módosít', async () => {
      const scripted = scriptedRunner(['drains_until_released']);
      const harness = openHarness({ agentQueryRunner: scripted.runner });
      const workflowId = createWorkflow(
        harness.database,
        'megszakitas-leallasi-ablak',
        [startNode('start'), agentNode('a1', 'egy'), approvalNode('jov', null)],
        [edgeOf('e1', 'start', 'a1'), edgeOf('e2', 'start', 'jov')],
      );
      const started = okOrThrow(await harness.engine.startRun({ workflowId, input: {} }));
      await waitForRunningAndQueued(harness.database, started.run.id, 1, 0);
      const approvalStepRunId = await waitForPendingApproval(harness.database, started.run.id);

      const interrupting = harness.engine.interruptRun(started.run.id);
      await waitForInterruptCalls(scripted.calls, 1);
      expect(okOrThrow(harness.database.runs.getRun(started.run.id)).status).toBe('running');

      const late = await harness.engine.decideApproval({ stepRunId: approvalStepRunId, decision: 'approved' });

      // A javítás előtt a döntés átment, a lépés `succeeded` lett egy
      // `cancelled` futásban.
      expect(late.kind === 'error' ? late.message : '').toContain('(illegal_status_transition)');
      expect(okOrThrow(harness.database.stepRuns.getStepRun(approvalStepRunId)).status).toBe('cancelled');
      expect(okOrThrow(harness.database.approvals.getApprovalForStep(approvalStepRunId)).decision).toBeNull();

      scripted.releaseDrain();
      const summary = okOrThrow(await interrupting);

      expect(summary.cancelledRunIds).toStrictEqual([started.run.id]);
      expect(okOrThrow(harness.database.runs.getRun(started.run.id)).status).toBe('cancelled');
      expect(okOrThrow(harness.database.stepRuns.getStepRun(approvalStepRunId)).status).toBe('cancelled');
      expect(okOrThrow(harness.database.approvals.getApprovalForStep(approvalStepRunId)).decision).toBeNull();
      expect(hasPublishedEvent(harness.published, 'step_finished', approvalStepRunId)).toBe(false);
      expect(hasPublishedEvent(harness.published, 'approval_decided', approvalStepRunId)).toBe(false);
    });

    it('REGRESSZIÓ: korlát 1 mellett a futás sorban álló agent lépései a megszakítás után sem indulnak el, egyetlen agent hívás történik, a soruk cancelled (SPEC-004 9. szekció 2. pont)', async () => {
      const controlled = controlledMessageIterable('parhuzamos');
      let runCalls = 0;
      // Az első hívás a megszakításig fut; minden további hívás azonnal
      // sikeres volna, tehát a javítás nélkül a két sorban álló lépés a
      // felszabaduló helyen egymás után lefutna, és a hívásszám három lenne.
      const runner: AgentQueryRunner = {
        run: () => {
          runCalls += 1;
          if (runCalls > 1) {
            return {
              kind: 'ok',
              value: { messages: messageIterable(successMessages(runCalls)), interrupt: () => Promise.resolve() },
            };
          }
          return {
            kind: 'ok',
            value: {
              messages: controlled.messages,
              interrupt: () => {
                controlled.release();
                return Promise.resolve();
              },
            },
          };
        },
      };
      const harness = openHarness({ agentQueryRunner: runner });
      const workflowId = createWorkflow(
        harness.database,
        'parhuzamos',
        [startNode('start'), agentNode('a1', 'egy'), agentNode('a2', 'ketto'), agentNode('a3', 'harom')],
        [edgeOf('e1', 'start', 'a1'), edgeOf('e2', 'start', 'a2'), edgeOf('e3', 'start', 'a3')],
      );
      okOrThrow(harness.database.concurrencyLimits.setLimit('minimax', 1));
      const started = okOrThrow(await harness.engine.startRun({ workflowId, input: {} }));
      const [runningNodeId] = await waitForRunningAndQueued(harness.database, started.run.id, 1, 2);

      const summary = okOrThrow(await harness.engine.interruptRun(started.run.id));

      expect(runCalls).toBe(1);
      expect(summary.cancelledRunIds).toStrictEqual([started.run.id]);
      expect(okOrThrow(harness.database.runs.getRun(started.run.id)).status).toBe('cancelled');
      const queuedSteps = okOrThrow(harness.database.stepRuns.listStepRuns(started.run.id)).filter(
        (step) => step.nodeType === 'agent_step' && step.nodeId !== runningNodeId,
      );
      expect(queuedSteps.map((step) => step.status)).toStrictEqual(['cancelled', 'cancelled']);
      // A kivett lépés el sem indult, tehát `step_started` eseménye sincs.
      for (const step of queuedSteps) {
        expect(hasPublishedEvent(harness.published, 'step_started', step.id)).toBe(false);
      }
    });

    it('REGRESSZIÓ: egy csak sorban álló futás megszakítása nem vár a helyet foglaló MÁSIK futásra, és nem indít agent hívást (SPEC-004 9. szekció 2. pont)', async () => {
      const controlled = controlledMessageIterable('masik-futas');
      let runCalls = 0;
      const runner: AgentQueryRunner = {
        run: () => {
          runCalls += 1;
          if (runCalls > 1) {
            return {
              kind: 'ok',
              value: { messages: messageIterable(successMessages(runCalls)), interrupt: () => Promise.resolve() },
            };
          }
          return { kind: 'ok', value: agentQueryOf(controlled.messages) };
        },
      };
      const harness = openHarness({ agentQueryRunner: runner });
      const workflowId = createWorkflow(
        harness.database,
        'csak-sorban-allo',
        [startNode('start'), agentNode('a1', 'lassu')],
        [edgeOf('e1', 'start', 'a1')],
      );
      okOrThrow(harness.database.concurrencyLimits.setLimit('minimax', 1));
      const holding = okOrThrow(await harness.engine.startRun({ workflowId, input: {} }));
      await waitForStepRunning(harness.database, holding.run.id, 'a1');
      const queued = okOrThrow(await harness.engine.startRun({ workflowId, input: {} }));
      await waitForStepQueued(harness.database, queued.run.id, 'a1');

      // A másik futás lépése a teszt végéig fut: ha a megszakítás rá várna,
      // a hívás itt nem érne véget.
      const progress = { hasSettled: false };
      const interrupting = (async (): Promise<Outcome<unknown>> => {
        const outcome = await harness.engine.interruptRun(queued.run.id);
        progress.hasSettled = true;
        return outcome;
      })();
      for (let attempt = 0; attempt < 2000 && !progress.hasSettled; attempt += 1) {
        await Promise.resolve();
      }

      expect(progress.hasSettled).toBe(true);
      expect(runCalls).toBe(1);
      expect(okOrThrow(harness.database.runs.getRun(queued.run.id)).status).toBe('cancelled');
      expect(
        okOrThrow(harness.database.stepRuns.listStepRuns(queued.run.id))
          .filter((step) => step.nodeId === 'a1')
          .map((step) => step.status),
      ).toStrictEqual(['cancelled']);

      controlled.release();
      okOrThrow(await interrupting);
      expect(await waitForRunStatus(harness.database, holding.run.id, TERMINAL_RUN_STATUSES)).toBe('succeeded');
      expect(runCalls).toBe(1);
    });
  });

  describe('fail_run hibapolitika: a testvér lépések leállítása (SPEC-004 8.3, 43. kritérium)', () => {
    it('REGRESSZIÓ: korlát 1 mellett a bukás után a két sorban álló testvér el sem indul, egyetlen agent hívás történik, a soruk cancelled, a futás failed', async () => {
      const scripted = scriptedRunner(['fails_when_released']);
      const harness = openHarness({ agentQueryRunner: scripted.runner });
      const workflowId = threeParallelAgentSteps(harness.database, 'fail-run-korlat-1', 'fail_run');
      okOrThrow(harness.database.concurrencyLimits.setLimit('minimax', 1));
      const started = okOrThrow(await harness.engine.startRun({ workflowId, input: {} }));
      const [failingNodeId] = await waitForRunningAndQueued(harness.database, started.run.id, 1, 2);

      scripted.releaseFailure();
      const status = await waitForRunStatus(harness.database, started.run.id, TERMINAL_RUN_STATUSES);

      expect(scripted.calls.run).toBe(1);
      expect(status).toBe('failed');
      expect(okOrThrow(harness.database.runs.getRun(started.run.id)).errorKind).toBe('agent_result_not_success');
      const siblings = okOrThrow(harness.database.stepRuns.listStepRuns(started.run.id)).filter(
        (step) => step.nodeType === 'agent_step' && step.nodeId !== failingNodeId,
      );
      expect(siblings.map((step) => step.status)).toStrictEqual(['cancelled', 'cancelled']);
      for (const step of siblings) {
        expect(hasPublishedEvent(harness.published, 'step_started', step.id)).toBe(false);
      }
    });

    it('REGRESSZIÓ: korlát 2 mellett a futó testvér interrupt()-ot kap, a sorban álló el sem indul, és a futás a futó testvér természetes vége nélkül failed', async () => {
      // A második hívás magától SOSEM ér véget: ha a motor a természetes
      // lefutására várna, a futás nem érne terminális állapotba.
      const scripted = scriptedRunner(['fails_when_released', 'runs_until_interrupt']);
      const harness = openHarness({ agentQueryRunner: scripted.runner });
      const workflowId = threeParallelAgentSteps(harness.database, 'fail-run-korlat-2', 'fail_run');
      okOrThrow(harness.database.concurrencyLimits.setLimit('minimax', 2));
      const started = okOrThrow(await harness.engine.startRun({ workflowId, input: {} }));
      await waitForRunningAndQueued(harness.database, started.run.id, 2, 1);

      scripted.releaseFailure();
      const status = await waitForRunStatus(harness.database, started.run.id, TERMINAL_RUN_STATUSES);

      expect(scripted.calls.run).toBe(2);
      expect(scripted.calls.interrupt).toBe(1);
      expect(status).toBe('failed');
      const agentSteps = okOrThrow(harness.database.stepRuns.listStepRuns(started.run.id)).filter(
        (step) => step.nodeType === 'agent_step',
      );
      // A bukott lépés failed; a megszakított, futó testvér a saját
      // (megszakítás utáni) eredménye szerint zár; a sorban álló cancelled.
      const countOf = (status: string): number => agentSteps.filter((step) => step.status === status).length;
      expect([countOf('failed'), countOf('succeeded'), countOf('cancelled')]).toStrictEqual([1, 1, 1]);
      const queued = agentSteps.find((step) => step.status === 'cancelled');
      expect(hasPublishedEvent(harness.published, 'step_started', queued?.id ?? '')).toBe(false);
    });

    it('REGRESSZIÓ: egy MÁSIK futás sorban álló lépése érintetlen: a felszabaduló helyet megkapja és lefut, a bukott futás testvére nem', async () => {
      const scripted = scriptedRunner(['fails_when_released']);
      const harness = openHarness({ agentQueryRunner: scripted.runner });
      const failingWorkflowId = createWorkflow(
        harness.database,
        'fail-run-futas',
        [startNode('start'), agentNode('a1', 'egy'), agentNode('a2', 'ketto')],
        [edgeOf('e1', 'start', 'a1'), edgeOf('e2', 'start', 'a2')],
      );
      const otherWorkflowId = createWorkflow(
        harness.database,
        'masik-futas',
        // A node és az él azonosítója az adatbázisban globálisan egyedi.
        [startNode('start-b'), agentNode('b1', 'masik')],
        [edgeOf('eb1', 'start-b', 'b1')],
      );
      okOrThrow(harness.database.concurrencyLimits.setLimit('minimax', 1));
      const failing = okOrThrow(await harness.engine.startRun({ workflowId: failingWorkflowId, input: {} }));
      const [failingNodeId] = await waitForRunningAndQueued(harness.database, failing.run.id, 1, 1);
      const other = okOrThrow(await harness.engine.startRun({ workflowId: otherWorkflowId, input: {} }));
      await waitForStepQueued(harness.database, other.run.id, 'b1');

      scripted.releaseFailure();

      expect(await waitForRunStatus(harness.database, failing.run.id, TERMINAL_RUN_STATUSES)).toBe('failed');
      expect(await waitForRunStatus(harness.database, other.run.id, TERMINAL_RUN_STATUSES)).toBe('succeeded');
      // Két hívás: a bukott lépésé és a másik futás lépéséé; a bukott futás
      // sorban álló testvére nem kapott hívást.
      expect(scripted.calls.run).toBe(2);
      const sibling = okOrThrow(harness.database.stepRuns.listStepRuns(failing.run.id)).find(
        (step) => step.nodeType === 'agent_step' && step.nodeId !== failingNodeId,
      );
      expect(sibling?.status).toBe('cancelled');
      expect(
        okOrThrow(harness.database.stepRuns.listStepRuns(other.run.id))
          .filter((step) => step.nodeId === 'b1')
          .map((step) => step.status),
      ).toStrictEqual(['succeeded']);
    });

    it('REGRESSZIÓ: helyet nem foglaló lépés bukása (elutasított jóváhagyás) után is kiesik a sorból a testvér, és a futó testvér interrupt()-ot kap', async () => {
      // A hibázó lépés itt nem agent lépés, tehát a saját helyét sem
      // szabadítja fel: a sorban álló testvért a léptető hurok veszi ki a
      // sorból, MIELŐTT a futó testvér a megszakítás után felszabadítaná a
      // helyet.
      const scripted = scriptedRunner(['runs_until_interrupt']);
      const harness = openHarness({ agentQueryRunner: scripted.runner });
      const workflowId = createWorkflow(
        harness.database,
        'fail-run-jovahagyas',
        [startNode('start'), agentNode('a1', 'egy'), agentNode('a2', 'ketto'), approvalNode('jov', null)],
        [edgeOf('e1', 'start', 'a1'), edgeOf('e2', 'start', 'a2'), edgeOf('e3', 'start', 'jov')],
      );
      okOrThrow(harness.database.concurrencyLimits.setLimit('minimax', 1));
      const started = okOrThrow(await harness.engine.startRun({ workflowId, input: {} }));
      const [runningNodeId] = await waitForRunningAndQueued(harness.database, started.run.id, 1, 1);
      const approvalStepRunId = await waitForPendingApproval(harness.database);

      okOrThrow(await harness.engine.decideApproval({ stepRunId: approvalStepRunId, decision: 'rejected' }));
      const status = await waitForRunStatus(harness.database, started.run.id, TERMINAL_RUN_STATUSES);

      expect(scripted.calls.run).toBe(1);
      expect(scripted.calls.interrupt).toBe(1);
      expect(status).toBe('failed');
      expect(okOrThrow(harness.database.runs.getRun(started.run.id)).errorKind).toBe('approval_rejected');
      const queued = okOrThrow(harness.database.stepRuns.listStepRuns(started.run.id)).find(
        (step) => step.nodeType === 'agent_step' && step.nodeId !== runningNodeId,
      );
      expect(queued?.status).toBe('cancelled');
      expect(hasPublishedEvent(harness.published, 'step_started', queued?.id ?? '')).toBe(false);
    });

    it('HATÁR: fail_branch mellett a sorban álló testvérek a bukás után is lefutnak, a futás a végén failed (SPEC-004 8.3, 8.4)', async () => {
      const scripted = scriptedRunner(['fails_when_released']);
      const harness = openHarness({ agentQueryRunner: scripted.runner });
      const workflowId = threeParallelAgentSteps(harness.database, 'fail-branch-korlat-1', 'fail_branch');
      okOrThrow(harness.database.concurrencyLimits.setLimit('minimax', 1));
      const started = okOrThrow(await harness.engine.startRun({ workflowId, input: {} }));
      const [failingNodeId] = await waitForRunningAndQueued(harness.database, started.run.id, 1, 2);

      scripted.releaseFailure();
      const status = await waitForRunStatus(harness.database, started.run.id, TERMINAL_RUN_STATUSES);

      expect(scripted.calls.run).toBe(3);
      expect(scripted.calls.interrupt).toBe(0);
      expect(status).toBe('failed');
      const siblings = okOrThrow(harness.database.stepRuns.listStepRuns(started.run.id)).filter(
        (step) => step.nodeType === 'agent_step' && step.nodeId !== failingNodeId,
      );
      expect(siblings.map((step) => step.status)).toStrictEqual(['succeeded', 'succeeded']);
    });

    it('REGRESSZIÓ: a döntésre váró human_approval testvér a bukás után cancelled, a futás döntés nélkül failed, az utólagos döntés illegal_status_transition hibát ad és semmit nem módosít', async () => {
      const scripted = scriptedRunner(['fails_when_released']);
      const harness = openHarness({ agentQueryRunner: scripted.runner });
      const workflowId = createWorkflow(
        harness.database,
        'fail-run-varakozo-jovahagyas',
        [startNode('start'), agentNode('a1', 'egy'), approvalNode('jov', null)],
        [edgeOf('e1', 'start', 'a1'), edgeOf('e2', 'start', 'jov')],
      );
      const started = okOrThrow(await harness.engine.startRun({ workflowId, input: {} }));
      await waitForRunningAndQueued(harness.database, started.run.id, 1, 0);
      const approvalStepRunId = await waitForPendingApproval(harness.database);

      scripted.releaseFailure();
      // A javítás előtt a futás a döntésig `running` maradt, ez a várakozás
      // tehát elbukott.
      const status = await waitForRunStatus(harness.database, started.run.id, TERMINAL_RUN_STATUSES);

      expect(status).toBe('failed');
      expect(okOrThrow(harness.database.runs.getRun(started.run.id)).errorKind).toBe('agent_result_not_success');
      expect(okOrThrow(harness.database.stepRuns.getStepRun(approvalStepRunId)).status).toBe('cancelled');
      // A `human_approval` táblának nincs állapot oszlopa: a döntés NULL marad,
      // ugyanúgy, mint a felhasználói megszakítás után.
      expect(okOrThrow(harness.database.approvals.getApprovalForStep(approvalStepRunId)).decision).toBeNull();
      const publishedBefore = harness.published.length;

      const late = await harness.engine.decideApproval({ stepRunId: approvalStepRunId, decision: 'approved' });

      expect(late.kind === 'error' ? late.message : '').toContain('(illegal_status_transition)');
      expect(okOrThrow(harness.database.stepRuns.getStepRun(approvalStepRunId)).status).toBe('cancelled');
      expect(okOrThrow(harness.database.approvals.getApprovalForStep(approvalStepRunId)).decision).toBeNull();
      expect(okOrThrow(harness.database.runs.getRun(started.run.id)).status).toBe('failed');
      expect(harness.published).toHaveLength(publishedBefore);
    });

    it('REGRESSZIÓ: a leállási ablakban (a futó testvér folyamának kimerülése alatt) érkező döntés illegal_status_transition hibát ad, és semmit nem módosít', async () => {
      const scripted = scriptedRunner(['fails_when_released', 'drains_until_released']);
      const harness = openHarness({ agentQueryRunner: scripted.runner });
      const workflowId = createWorkflow(
        harness.database,
        'fail-run-leallasi-ablak',
        [startNode('start'), agentNode('a1', 'egy'), agentNode('a2', 'ketto'), approvalNode('jov', null)],
        [edgeOf('e1', 'start', 'a1'), edgeOf('e2', 'start', 'a2'), edgeOf('e3', 'start', 'jov')],
      );
      const started = okOrThrow(await harness.engine.startRun({ workflowId, input: {} }));
      await waitForRunningAndQueued(harness.database, started.run.id, 2, 0);
      const approvalStepRunId = await waitForPendingApproval(harness.database, started.run.id);

      scripted.releaseFailure();
      await waitForInterruptCalls(scripted.calls, 1);
      // A leállási ablak: a futó testvér megkapta az `interrupt()`-ot, de a
      // folyama még nem merült ki, tehát a futás nem terminális.
      expect(okOrThrow(harness.database.runs.getRun(started.run.id)).status).toBe('running');

      const late = await harness.engine.decideApproval({ stepRunId: approvalStepRunId, decision: 'approved' });

      // A javítás előtt a döntés átment, a lépés `succeeded` lett.
      expect(late.kind === 'error' ? late.message : '').toContain('(illegal_status_transition)');
      expect(okOrThrow(harness.database.stepRuns.getStepRun(approvalStepRunId)).status).toBe('cancelled');
      expect(okOrThrow(harness.database.approvals.getApprovalForStep(approvalStepRunId)).decision).toBeNull();

      scripted.releaseDrain();

      expect(await waitForRunStatus(harness.database, started.run.id, TERMINAL_RUN_STATUSES)).toBe('failed');
      expect(okOrThrow(harness.database.stepRuns.getStepRun(approvalStepRunId)).status).toBe('cancelled');
      expect(okOrThrow(harness.database.approvals.getApprovalForStep(approvalStepRunId)).decision).toBeNull();
      expect(hasPublishedEvent(harness.published, 'step_finished', approvalStepRunId)).toBe(false);
      expect(hasPublishedEvent(harness.published, 'approval_decided', approvalStepRunId)).toBe(false);
    });

    it('REGRESSZIÓ: egy MÁSIK futás döntésre váró jóváhagyása érintetlen marad, és a döntés után a saját útján zár', async () => {
      const scripted = scriptedRunner(['fails_when_released']);
      const harness = openHarness({ agentQueryRunner: scripted.runner });
      const failingWorkflowId = createWorkflow(
        harness.database,
        'fail-run-jovahagyassal',
        [startNode('start'), agentNode('a1', 'egy'), approvalNode('jov', null)],
        [edgeOf('e1', 'start', 'a1'), edgeOf('e2', 'start', 'jov')],
      );
      const otherWorkflowId = createWorkflow(
        harness.database,
        'masik-jovahagyas',
        // A node és az él azonosítója az adatbázisban globálisan egyedi.
        [startNode('start-b'), approvalNode('jov-b', null)],
        [edgeOf('eb1', 'start-b', 'jov-b')],
      );
      const other = okOrThrow(await harness.engine.startRun({ workflowId: otherWorkflowId, input: {} }));
      const otherApprovalStepRunId = await waitForPendingApproval(harness.database, other.run.id);
      const failing = okOrThrow(await harness.engine.startRun({ workflowId: failingWorkflowId, input: {} }));
      await waitForRunningAndQueued(harness.database, failing.run.id, 1, 0);
      await waitForPendingApproval(harness.database, failing.run.id);

      scripted.releaseFailure();

      expect(await waitForRunStatus(harness.database, failing.run.id, TERMINAL_RUN_STATUSES)).toBe('failed');
      expect(okOrThrow(harness.database.runs.getRun(other.run.id)).status).toBe('running');
      expect(okOrThrow(harness.database.stepRuns.getStepRun(otherApprovalStepRunId)).status).toBe('waiting_approval');

      okOrThrow(await harness.engine.decideApproval({ stepRunId: otherApprovalStepRunId, decision: 'approved' }));

      expect(await waitForRunStatus(harness.database, other.run.id, TERMINAL_RUN_STATUSES)).toBe('succeeded');
      expect(okOrThrow(harness.database.stepRuns.getStepRun(otherApprovalStepRunId)).status).toBe('succeeded');
    });

    it('HATÁR: fail_branch mellett a döntésre váró jóváhagyás a bukás feldolgozása után is vár, és a futás csak a döntés után failed (SPEC-004 8.3, 8.4)', async () => {
      const scripted = scriptedRunner(['fails_when_released']);
      const harness = openHarness({ agentQueryRunner: scripted.runner });
      // A `utana` két bejövő éle (`start`, `a1`) miatt csak akkor válik
      // futtathatóvá, amikor a léptető hurok az `a1` bukását már feldolgozta
      // (a `fail_branch` halott jelölése, SPEC-004 4.4 2. pont): a sora a
      // teszt megfigyelhető jele, hogy a hurok a bukásra már reagált.
      const workflowId = createWorkflow(
        harness.database,
        'fail-branch-jovahagyas',
        [
          startNode('start'),
          agentNode('a1', 'egy', 'fail_branch'),
          agentNode('utana', 'utana'),
          approvalNode('jov', null),
        ],
        [
          edgeOf('e1', 'start', 'a1'),
          edgeOf('e2', 'start', 'utana'),
          edgeOf('e3', 'a1', 'utana'),
          edgeOf('e4', 'start', 'jov'),
        ],
      );
      const started = okOrThrow(await harness.engine.startRun({ workflowId, input: {} }));
      await waitForStepRunning(harness.database, started.run.id, 'a1');
      const approvalStepRunId = await waitForPendingApproval(harness.database);

      scripted.releaseFailure();
      await waitForStepStatus(harness.database, started.run.id, 'utana', 'succeeded');

      expect(okOrThrow(harness.database.runs.getRun(started.run.id)).status).toBe('running');
      expect(okOrThrow(harness.database.stepRuns.getStepRun(approvalStepRunId)).status).toBe('waiting_approval');

      okOrThrow(await harness.engine.decideApproval({ stepRunId: approvalStepRunId, decision: 'approved' }));

      expect(await waitForRunStatus(harness.database, started.run.id, TERMINAL_RUN_STATUSES)).toBe('failed');
      expect(okOrThrow(harness.database.runs.getRun(started.run.id)).errorKind).toBe('agent_result_not_success');
      expect(okOrThrow(harness.database.stepRuns.getStepRun(approvalStepRunId)).status).toBe('succeeded');
      // A döntést a végrehajtó kapta meg, nem egy korábban lezárt várakozás:
      // lezárt várakozás után a sor ugyan átmenne, de esemény nem íródna.
      expect(hasPublishedEvent(harness.published, 'approval_decided', approvalStepRunId)).toBe(true);
    });

    it('REGRESSZIÓ: a futó sub_workflow testvér gyerek futása a bukás után cancelled, a várakozó jóváhagyása lezárul, a szülő a gyerek döntése nélkül failed, az utólagos döntés illegal_status_transition hibát ad', async () => {
      const scripted = scriptedRunner(['fails_when_released']);
      const harness = openHarness({ agentQueryRunner: scripted.runner });
      const childWorkflowId = waitingChildWorkflow(harness.database, 'gyerek-jovahagyassal', 'c');
      const workflowId = createWorkflow(
        harness.database,
        'fail-run-sub-workflow',
        [startNode('start'), agentNode('a1', 'egy'), subWorkflowNode('sub', childWorkflowId)],
        [edgeOf('e1', 'start', 'a1'), edgeOf('e2', 'start', 'sub')],
      );
      const started = okOrThrow(await harness.engine.startRun({ workflowId, input: {} }));
      await waitForStepRunning(harness.database, started.run.id, 'a1');
      const childRunId = await waitForChildRunId(harness.database, started.run.id, 'sub');
      const childApprovalStepRunId = await waitForPendingApproval(harness.database, childRunId);

      scripted.releaseFailure();
      // A javítás előtt a szülő a gyerek döntéséig `running` maradt, ez a
      // várakozás tehát elbukott.
      const status = await waitForRunStatus(harness.database, started.run.id, TERMINAL_RUN_STATUSES);

      expect(status).toBe('failed');
      expect(okOrThrow(harness.database.runs.getRun(started.run.id)).errorKind).toBe('agent_result_not_success');
      expect(okOrThrow(harness.database.runs.getRun(childRunId)).status).toBe('cancelled');
      expect(findRunFinishedStatus(harness.published, childRunId)).toBe('cancelled');
      expect(okOrThrow(harness.database.stepRuns.getStepRun(childApprovalStepRunId)).status).toBe('cancelled');
      expect(okOrThrow(harness.database.approvals.getApprovalForStep(childApprovalStepRunId)).decision).toBeNull();
      // A futó `sub_workflow` lépés a saját eredménye szerint zár: a gyerek
      // nem `succeeded`, tehát `failed`, `sub_workflow_failed` osztállyal
      // (SPEC-004 5.9 6. pont, 8.3).
      const subStep = okOrThrow(harness.database.stepRuns.listStepRuns(started.run.id)).find(
        (step) => step.nodeId === 'sub',
      );
      expect([subStep?.status, subStep?.errorKind]).toStrictEqual(['failed', 'sub_workflow_failed']);
      const publishedBefore = harness.published.length;

      const late = await harness.engine.decideApproval({ stepRunId: childApprovalStepRunId, decision: 'approved' });

      expect(late.kind === 'error' ? late.message : '').toContain('(illegal_status_transition)');
      expect(okOrThrow(harness.database.stepRuns.getStepRun(childApprovalStepRunId)).status).toBe('cancelled');
      expect(okOrThrow(harness.database.approvals.getApprovalForStep(childApprovalStepRunId)).decision).toBeNull();
      expect(okOrThrow(harness.database.runs.getRun(childRunId)).status).toBe('cancelled');
      expect(okOrThrow(harness.database.runs.getRun(started.run.id)).status).toBe('failed');
      expect(harness.published).toHaveLength(publishedBefore);
    });

    it('REGRESSZIÓ: a gyerek futás al-workflow futása (unoka) is cancelled, a várakozó jóváhagyásával együtt', async () => {
      const scripted = scriptedRunner(['fails_when_released']);
      const harness = openHarness({ agentQueryRunner: scripted.runner });
      const grandchildWorkflowId = waitingChildWorkflow(harness.database, 'unoka-jovahagyassal', 'u');
      const childWorkflowId = createWorkflow(
        harness.database,
        'gyerek-unokaval',
        [startNode('c-start'), subWorkflowNode('c-sub', grandchildWorkflowId)],
        [edgeOf('c-e1', 'c-start', 'c-sub')],
      );
      const workflowId = createWorkflow(
        harness.database,
        'fail-run-unoka',
        [startNode('start'), agentNode('a1', 'egy'), subWorkflowNode('sub', childWorkflowId)],
        [edgeOf('e1', 'start', 'a1'), edgeOf('e2', 'start', 'sub')],
      );
      const started = okOrThrow(await harness.engine.startRun({ workflowId, input: {} }));
      await waitForStepRunning(harness.database, started.run.id, 'a1');
      const childRunId = await waitForChildRunId(harness.database, started.run.id, 'sub');
      const grandchildRunId = await waitForChildRunId(harness.database, childRunId, 'c-sub');
      const grandchildApprovalStepRunId = await waitForPendingApproval(harness.database, grandchildRunId);

      scripted.releaseFailure();

      expect(await waitForRunStatus(harness.database, started.run.id, TERMINAL_RUN_STATUSES)).toBe('failed');
      expect(okOrThrow(harness.database.runs.getRun(childRunId)).status).toBe('cancelled');
      expect(okOrThrow(harness.database.runs.getRun(grandchildRunId)).status).toBe('cancelled');
      expect(findRunFinishedStatus(harness.published, grandchildRunId)).toBe('cancelled');
      expect(okOrThrow(harness.database.stepRuns.getStepRun(grandchildApprovalStepRunId)).status).toBe('cancelled');
      const late = await harness.engine.decideApproval({
        stepRunId: grandchildApprovalStepRunId,
        decision: 'approved',
      });
      expect(late.kind === 'error' ? late.message : '').toContain('(illegal_status_transition)');
    });

    it('REGRESSZIÓ: egy MÁSIK futás gyerek futása és annak várakozó jóváhagyása érintetlen, a döntés után a saját útján zár', async () => {
      const scripted = scriptedRunner(['fails_when_released']);
      const harness = openHarness({ agentQueryRunner: scripted.runner });
      const childWorkflowId = waitingChildWorkflow(harness.database, 'gyerek-jovahagyassal', 'c');
      const failingWorkflowId = createWorkflow(
        harness.database,
        'fail-run-sub-workflow',
        [startNode('start'), agentNode('a1', 'egy'), subWorkflowNode('sub', childWorkflowId)],
        [edgeOf('e1', 'start', 'a1'), edgeOf('e2', 'start', 'sub')],
      );
      const otherWorkflowId = createWorkflow(
        harness.database,
        'masik-sub-workflow',
        // A node és az él azonosítója az adatbázisban globálisan egyedi.
        [startNode('start-b'), subWorkflowNode('sub-b', childWorkflowId)],
        [edgeOf('eb1', 'start-b', 'sub-b')],
      );
      const other = okOrThrow(await harness.engine.startRun({ workflowId: otherWorkflowId, input: {} }));
      const otherChildRunId = await waitForChildRunId(harness.database, other.run.id, 'sub-b');
      const otherApprovalStepRunId = await waitForPendingApproval(harness.database, otherChildRunId);
      const failing = okOrThrow(await harness.engine.startRun({ workflowId: failingWorkflowId, input: {} }));
      await waitForStepRunning(harness.database, failing.run.id, 'a1');
      const failingChildRunId = await waitForChildRunId(harness.database, failing.run.id, 'sub');
      await waitForPendingApproval(harness.database, failingChildRunId);

      scripted.releaseFailure();

      expect(await waitForRunStatus(harness.database, failing.run.id, TERMINAL_RUN_STATUSES)).toBe('failed');
      expect(okOrThrow(harness.database.runs.getRun(failingChildRunId)).status).toBe('cancelled');
      expect(okOrThrow(harness.database.runs.getRun(other.run.id)).status).toBe('running');
      expect(okOrThrow(harness.database.runs.getRun(otherChildRunId)).status).toBe('running');
      expect(okOrThrow(harness.database.stepRuns.getStepRun(otherApprovalStepRunId)).status).toBe('waiting_approval');

      okOrThrow(await harness.engine.decideApproval({ stepRunId: otherApprovalStepRunId, decision: 'approved' }));

      expect(await waitForRunStatus(harness.database, other.run.id, TERMINAL_RUN_STATUSES)).toBe('succeeded');
      expect(okOrThrow(harness.database.runs.getRun(otherChildRunId)).status).toBe('succeeded');
    });

    it('HATÁR: fail_branch mellett a futó sub_workflow testvér gyerek futása a bukás feldolgozása után is vár, és a szülő csak a gyerek döntése után failed (SPEC-004 8.3, 8.4)', async () => {
      const scripted = scriptedRunner(['fails_when_released']);
      const harness = openHarness({ agentQueryRunner: scripted.runner });
      const childWorkflowId = waitingChildWorkflow(harness.database, 'gyerek-jovahagyassal', 'c');
      // Az `utana` a bukás feldolgozásának megfigyelhető jele, ugyanúgy, mint
      // a jóváhagyásos `fail_branch` határtesztben.
      const workflowId = createWorkflow(
        harness.database,
        'fail-branch-sub-workflow',
        [
          startNode('start'),
          agentNode('a1', 'egy', 'fail_branch'),
          agentNode('utana', 'utana'),
          subWorkflowNode('sub', childWorkflowId),
        ],
        [
          edgeOf('e1', 'start', 'a1'),
          edgeOf('e2', 'start', 'utana'),
          edgeOf('e3', 'a1', 'utana'),
          edgeOf('e4', 'start', 'sub'),
        ],
      );
      const started = okOrThrow(await harness.engine.startRun({ workflowId, input: {} }));
      await waitForStepRunning(harness.database, started.run.id, 'a1');
      const childRunId = await waitForChildRunId(harness.database, started.run.id, 'sub');
      const childApprovalStepRunId = await waitForPendingApproval(harness.database, childRunId);

      scripted.releaseFailure();
      await waitForStepStatus(harness.database, started.run.id, 'utana', 'succeeded');

      expect(okOrThrow(harness.database.runs.getRun(started.run.id)).status).toBe('running');
      expect(okOrThrow(harness.database.runs.getRun(childRunId)).status).toBe('running');
      expect(okOrThrow(harness.database.stepRuns.getStepRun(childApprovalStepRunId)).status).toBe('waiting_approval');

      okOrThrow(await harness.engine.decideApproval({ stepRunId: childApprovalStepRunId, decision: 'approved' }));

      expect(await waitForRunStatus(harness.database, started.run.id, TERMINAL_RUN_STATUSES)).toBe('failed');
      expect(okOrThrow(harness.database.runs.getRun(childRunId)).status).toBe('succeeded');
      const subStep = okOrThrow(harness.database.stepRuns.listStepRuns(started.run.id)).find(
        (step) => step.nodeId === 'sub',
      );
      expect(subStep?.status).toBe('succeeded');
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

    it('REGRESSZIÓ: a futó agent lépés leállítása KÖZBEN hívott startRun engine_shutting_down hibát ad, és nem indít futást (SPEC-004 10.2 1. pont)', async () => {
      const controlled = controlledMessageIterable('leallas-kozben');
      const { promise: interruptCalled, resolve: signalInterrupt } = Promise.withResolvers<undefined>();
      let runCalls = 0;
      const holdingRunner: AgentQueryRunner = {
        run: () => {
          runCalls += 1;
          return {
            kind: 'ok',
            value: {
              messages: controlled.messages,
              // A leállítás itt SZÁNDÉKOSAN nem enged azonnal: a lépés
              // "leállítása tart", amíg a teszt el nem engedi, és közben
              // érkezik az új indítás.
              interrupt: () => {
                signalInterrupt(undefined);
                return Promise.resolve();
              },
            },
          };
        },
      };
      const harness = openHarness({ agentQueryRunner: holdingRunner });
      const workflowId = createWorkflow(
        harness.database,
        'leallas-kozben',
        [startNode('start'), agentNode('a1', 'lassu')],
        [edgeOf('e1', 'start', 'a1')],
      );
      const first = okOrThrow(await harness.engine.startRun({ workflowId, input: {} }));
      await waitForStepRunning(harness.database, first.run.id, 'a1');

      const shutdown = harness.engine.shutdown();
      await interruptCalled;
      const second = await harness.engine.startRun({ workflowId, input: {} });
      controlled.release();
      const summary = okOrThrow(await shutdown);

      expect(second.kind === 'error' ? second.message : '').toContain('(engine_shutting_down)');
      expect(okOrThrow(harness.database.runs.listRuns()).map((run) => run.id)).toStrictEqual([first.run.id]);
      expect(runCalls).toBe(1);
      expect(summary.interruptedRunCount).toBe(1);
      expect(okOrThrow(harness.database.runs.getRun(first.run.id)).status).toBe('interrupted');
    });

    it('REGRESSZIÓ: a szabályozó sorában álló agent lépés a leállás után sem indul el, amikor a futó lépés felszabadítja a helyet (SPEC-004 10.2 1. pont)', async () => {
      const controlled = controlledMessageIterable('sorban-allo');
      let runCalls = 0;
      // Az első hívás a leállításig fut; minden további hívás azonnal
      // sikeres volna, tehát a javítás nélkül a sorban álló lépés helyet
      // kapna, lefutna, és a hívásszám kettő lenne.
      const runner: AgentQueryRunner = {
        run: () => {
          runCalls += 1;
          if (runCalls > 1) {
            return {
              kind: 'ok',
              value: { messages: messageIterable(successMessages(runCalls)), interrupt: () => Promise.resolve() },
            };
          }
          return {
            kind: 'ok',
            value: {
              messages: controlled.messages,
              interrupt: () => {
                controlled.release();
                return Promise.resolve();
              },
            },
          };
        },
      };
      const harness = openHarness({ agentQueryRunner: runner });
      const workflowId = createWorkflow(
        harness.database,
        'sorban-allo',
        [startNode('start'), agentNode('a1', 'lassu')],
        [edgeOf('e1', 'start', 'a1')],
      );
      okOrThrow(harness.database.concurrencyLimits.setLimit('minimax', 1));
      const running = okOrThrow(await harness.engine.startRun({ workflowId, input: {} }));
      await waitForStepRunning(harness.database, running.run.id, 'a1');
      const queued = okOrThrow(await harness.engine.startRun({ workflowId, input: {} }));
      await waitForStepQueued(harness.database, queued.run.id, 'a1');

      const summary = okOrThrow(await harness.engine.shutdown());

      expect(runCalls).toBe(1);
      expect(summary.interruptedRunCount).toBe(2);
      expect(okOrThrow(harness.database.runs.getRun(queued.run.id)).status).toBe('interrupted');
      const queuedSteps = okOrThrow(harness.database.stepRuns.listStepRuns(queued.run.id));
      expect(queuedSteps.filter((step) => step.nodeId === 'a1').map((step) => step.status)).toStrictEqual([
        'interrupted',
      ]);
    });

    it('REGRESSZIÓ: a leállási ablakban (a futó testvér folyamának kimerülése alatt) érkező jóváhagyási döntés illegal_status_transition hibát ad, semmit nem módosít, és a jóváhagyás lépése interrupted (SPEC-004 10.2 3. pont)', async () => {
      const scripted = scriptedRunner(['drains_until_released']);
      const harness = openHarness({ agentQueryRunner: scripted.runner });
      const workflowId = createWorkflow(
        harness.database,
        'leallas-leallasi-ablak',
        [startNode('start'), agentNode('a1', 'egy'), approvalNode('jov', null)],
        [edgeOf('e1', 'start', 'a1'), edgeOf('e2', 'start', 'jov')],
      );
      const started = okOrThrow(await harness.engine.startRun({ workflowId, input: {} }));
      await waitForRunningAndQueued(harness.database, started.run.id, 1, 0);
      const approvalStepRunId = await waitForPendingApproval(harness.database, started.run.id);

      const shuttingDown = harness.engine.shutdown();
      await waitForInterruptCalls(scripted.calls, 1);
      // A leállási ablak: a futó testvér megkapta az `interrupt()`-ot, de a
      // folyama még nem merült ki, tehát a futás nem terminális.
      expect(okOrThrow(harness.database.runs.getRun(started.run.id)).status).toBe('running');

      const late = await harness.engine.decideApproval({ stepRunId: approvalStepRunId, decision: 'approved' });

      // A javítás előtt a döntés átment, a lépés `succeeded` lett egy
      // `interrupted` futásban.
      expect(late.kind === 'error' ? late.message : '').toContain('(illegal_status_transition)');
      expect(okOrThrow(harness.database.stepRuns.getStepRun(approvalStepRunId)).status).toBe('interrupted');
      expect(okOrThrow(harness.database.approvals.getApprovalForStep(approvalStepRunId)).decision).toBeNull();

      scripted.releaseDrain();
      const summary = okOrThrow(await shuttingDown);

      expect(summary.interruptedRunCount).toBe(1);
      expect(okOrThrow(harness.database.runs.getRun(started.run.id)).status).toBe('interrupted');
      expect(okOrThrow(harness.database.stepRuns.getStepRun(approvalStepRunId)).status).toBe('interrupted');
      expect(okOrThrow(harness.database.approvals.getApprovalForStep(approvalStepRunId)).decision).toBeNull();
      expect(hasPublishedEvent(harness.published, 'step_finished', approvalStepRunId)).toBe(false);
      expect(hasPublishedEvent(harness.published, 'approval_decided', approvalStepRunId)).toBe(false);
    });

    it('a leállás utáni újraindítás helyreállítása (runStartupRecovery) a jóváhagyás lépését interrupted állapotban hagyja, és egy új motor példányon érkező döntés is illegal_status_transition (SPEC-004 10.1, 10.2)', async () => {
      const scripted = scriptedRunner(['runs_until_interrupt']);
      const harness = openHarness({ agentQueryRunner: scripted.runner });
      const workflowId = createWorkflow(
        harness.database,
        'leallas-ujrainditas',
        [startNode('start'), agentNode('a1', 'egy'), approvalNode('jov', null)],
        [edgeOf('e1', 'start', 'a1'), edgeOf('e2', 'start', 'jov')],
      );
      const started = okOrThrow(await harness.engine.startRun({ workflowId, input: {} }));
      await waitForRunningAndQueued(harness.database, started.run.id, 1, 0);
      const approvalStepRunId = await waitForPendingApproval(harness.database, started.run.id);
      okOrThrow(await harness.engine.shutdown());

      // Az újraindítás: ugyanazon az adatbázison az indulási helyreállítás,
      // majd egy új motor példány (SPEC-004 10.1 sorrend).
      const recovered = okOrThrow(runStartupRecovery(harness.database));
      const restarted = openHarness({ database: harness.database });
      const late = await restarted.engine.decideApproval({ stepRunId: approvalStepRunId, decision: 'approved' });

      expect(recovered.recoveredRunCount).toBe(0);
      expect(okOrThrow(harness.database.runs.getRun(started.run.id)).status).toBe('interrupted');
      expect(okOrThrow(harness.database.stepRuns.getStepRun(approvalStepRunId)).status).toBe('interrupted');
      expect(late.kind === 'error' ? late.message : '').toContain('(illegal_status_transition)');
      expect(okOrThrow(harness.database.approvals.getApprovalForStep(approvalStepRunId)).decision).toBeNull();
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

  // A javítás előtt mindhárom leállítási úton a `sub_workflow_finished`
  // `status` mezője és a lépés üzenete `running` volt: a `sub` lépés a gyerek
  // sorát a gyerek léptetésének lezárulásakor olvasta, a fa DB zárása csak
  // utána fut (`docs/research/2026-09-23-megszakitas-leallas-meres.md`).
  describe('sub_workflow_finished: a leállított gyerek futás célállapota (SPEC-004 13. szekció, user döntés 2026-09-23)', () => {
    it('REGRESSZIÓ: felhasználói megszakításnál a gyerek és az unoka eseménye és lépés üzenete cancelled, egyezően a fa zárásával', async () => {
      const harness = openHarness();
      const workflowId = subWorkflowTree(harness.database, []);
      const started = okOrThrow(await harness.engine.startRun({ workflowId, input: {} }));
      const childRunId = await waitForChildRunId(harness.database, started.run.id, 'sub');
      const grandchildRunId = await waitForChildRunId(harness.database, childRunId, 'c-sub');
      await waitForPendingApproval(harness.database, grandchildRunId);

      okOrThrow(await harness.engine.interruptRun(started.run.id));

      expect(okOrThrow(harness.database.runs.getRun(started.run.id)).status).toBe('cancelled');
      expect(treeClosingOf(harness.database, started.run.id, childRunId)).toStrictEqual(closingFor('cancelled'));
    });

    it('REGRESSZIÓ: fail_run bukásnál a gyerek és az unoka eseménye és lépés üzenete cancelled, egyezően a fa zárásával', async () => {
      const scripted = scriptedRunner(['fails_when_released']);
      const harness = openHarness({ agentQueryRunner: scripted.runner });
      const workflowId = subWorkflowTree(harness.database, [agentNode('a1', 'egy')]);
      const started = okOrThrow(await harness.engine.startRun({ workflowId, input: {} }));
      await waitForStepRunning(harness.database, started.run.id, 'a1');
      const childRunId = await waitForChildRunId(harness.database, started.run.id, 'sub');
      const grandchildRunId = await waitForChildRunId(harness.database, childRunId, 'c-sub');
      await waitForPendingApproval(harness.database, grandchildRunId);

      scripted.releaseFailure();

      expect(await waitForRunStatus(harness.database, started.run.id, TERMINAL_RUN_STATUSES)).toBe('failed');
      expect(treeClosingOf(harness.database, started.run.id, childRunId)).toStrictEqual(closingFor('cancelled'));
    });

    it('REGRESSZIÓ: szabályos leállásnál a gyerek és az unoka eseménye és lépés üzenete interrupted, egyezően a fa zárásával', async () => {
      const harness = openHarness();
      const workflowId = subWorkflowTree(harness.database, []);
      const started = okOrThrow(await harness.engine.startRun({ workflowId, input: {} }));
      const childRunId = await waitForChildRunId(harness.database, started.run.id, 'sub');
      const grandchildRunId = await waitForChildRunId(harness.database, childRunId, 'c-sub');
      await waitForPendingApproval(harness.database, grandchildRunId);

      okOrThrow(await harness.engine.shutdown());

      expect(okOrThrow(harness.database.runs.getRun(started.run.id)).status).toBe('interrupted');
      expect(treeClosingOf(harness.database, started.run.id, childRunId)).toStrictEqual(closingFor('interrupted'));
    });

    it('HATÁR: a nem leállított gyerek eseménye a saját terminális állapotát hordozza (elutasított jóváhagyás után failed)', async () => {
      const harness = openHarness();
      const workflowId = subWorkflowTree(harness.database, []);
      const started = okOrThrow(await harness.engine.startRun({ workflowId, input: {} }));
      const childRunId = await waitForChildRunId(harness.database, started.run.id, 'sub');
      const grandchildRunId = await waitForChildRunId(harness.database, childRunId, 'c-sub');
      const approvalStepRunId = await waitForPendingApproval(harness.database, grandchildRunId);

      okOrThrow(await harness.engine.decideApproval({ stepRunId: approvalStepRunId, decision: 'rejected' }));

      expect(await waitForRunStatus(harness.database, started.run.id, TERMINAL_RUN_STATUSES)).toBe('failed');
      expect(treeClosingOf(harness.database, started.run.id, childRunId)).toStrictEqual(closingFor('failed'));
    });
  });

  // Két leállítás egy futáson: az első célállapota marad meg, a DB zárásban
  // is (SPEC-004 9. szekció "A leállított al-workflow futás célállapota", 10.2
  // 3. pont). A javítás előtt a szabályos leállás közben beágyazott `fail_run`
  // a már `interrupted` célú gyerek sorát `cancelled` állapotba írta, az
  // eseménye viszont `interrupted` volt
  // (`docs/research/2026-09-23-megszakitas-leallas-meres.md` 7. szekció).
  describe('szabályos leállás és beágyazott fail_run: az első leállítás célállapota (SPEC-004 9. szekció, 10.2)', () => {
    it('REGRESSZIÓ: előbb a leállás, közben a testvér sub_workflow bukása fail_run-t indít: a lassan leálló gyerek sora és eseménye egyaránt interrupted, a gyökér interrupted', async () => {
      const scripted = scriptedRunner(['drains_until_released']);
      const harness = openHarness({ agentQueryRunner: scripted.runner });
      const waitingChildWorkflowId = waitingChildWorkflow(harness.database, 'gyerek-a', 'a');
      const drainingChildWorkflowId = drainingChildWorkflow(harness.database, 'gyerek-b', 'b');
      const workflowId = createWorkflow(
        harness.database,
        'leallas-beagyazott-fail-run',
        [
          startNode('start'),
          subWorkflowNode('sub-a', waitingChildWorkflowId),
          subWorkflowNode('sub-b', drainingChildWorkflowId),
        ],
        [edgeOf('e-a', 'start', 'sub-a'), edgeOf('e-b', 'start', 'sub-b')],
      );
      const started = okOrThrow(await harness.engine.startRun({ workflowId, input: {} }));
      const waitingChildRunId = await waitForChildRunId(harness.database, started.run.id, 'sub-a');
      const drainingChildRunId = await waitForChildRunId(harness.database, started.run.id, 'sub-b');
      await waitForPendingApproval(harness.database, waitingChildRunId);
      await waitForStepRunning(harness.database, drainingChildRunId, 'b-agent');

      const shuttingDown = harness.engine.shutdown();
      // Az első `interrupt()` a leállásé. A másodikat a beágyazott `fail_run`
      // hívja: a jóváhagyáson álló gyerek leállása után a `sub-a` lépés bukik,
      // és a gyökér gyerek fa zárása a még leálló `b` gyereket is eléri.
      await waitForInterruptCalls(scripted.calls, 2);
      scripted.releaseDrain();
      okOrThrow(await shuttingDown);

      expect(okOrThrow(harness.database.runs.getRun(started.run.id)).status).toBe('interrupted');
      expect({
        a: subWorkflowClosingOf(harness.database, started.run.id, 'sub-a'),
        b: subWorkflowClosingOf(harness.database, started.run.id, 'sub-b'),
      }).toStrictEqual({ a: closingFor('interrupted').gyerek, b: closingFor('interrupted').gyerek });
      expect(findRunFinishedStatus(harness.published, drainingChildRunId)).toBeUndefined();
    });

    it('HATÁR: előbb a fail_run, közben a leállás: a gyerek sora és eseménye cancelled marad, a gyökér interrupted', async () => {
      const scripted = scriptedRunner(['drains_until_released']);
      const harness = openHarness({ agentQueryRunner: scripted.runner });
      const drainingChildWorkflowId = drainingChildWorkflow(harness.database, 'gyerek-b', 'b');
      // A `jov` elutasítása `rejected` él nélkül a `fail_run` kiváltója (5.8, 8.3).
      const workflowId = createWorkflow(
        harness.database,
        'fail-run-kozben-leallas',
        [startNode('start'), approvalNode('jov', null), subWorkflowNode('sub-b', drainingChildWorkflowId)],
        [edgeOf('e-jov', 'start', 'jov'), edgeOf('e-b', 'start', 'sub-b')],
      );
      const started = okOrThrow(await harness.engine.startRun({ workflowId, input: {} }));
      const approvalStepRunId = await waitForPendingApproval(harness.database, started.run.id);
      const drainingChildRunId = await waitForChildRunId(harness.database, started.run.id, 'sub-b');
      await waitForStepRunning(harness.database, drainingChildRunId, 'b-agent');

      okOrThrow(await harness.engine.decideApproval({ stepRunId: approvalStepRunId, decision: 'rejected' }));
      // A `fail_run` gyerek fa zárása `interrupt()`-ot hívott a gyereken, a
      // gyerek célállapota tehát már `cancelled`, amikor a leállás érkezik.
      await waitForInterruptCalls(scripted.calls, 1);
      const shuttingDown = harness.engine.shutdown();
      scripted.releaseDrain();
      okOrThrow(await shuttingDown);

      expect(okOrThrow(harness.database.runs.getRun(started.run.id)).status).toBe('interrupted');
      expect(subWorkflowClosingOf(harness.database, started.run.id, 'sub-b')).toStrictEqual(
        closingFor('cancelled').gyerek,
      );
      expect(findRunFinishedStatus(harness.published, drainingChildRunId)).toBe('cancelled');
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
