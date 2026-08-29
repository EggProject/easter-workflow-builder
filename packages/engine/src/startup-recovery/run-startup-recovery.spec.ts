/* eslint-disable unicorn/no-null -- a `WorkflowCreateInput.description` és a `GraphSnapshotDocument.workflow.description` tárolt null értéke (SPEC-003 4.3, 5.1), valamint a `ConcurrencyLimitLookup` korlátlan `null` visszatérése (SPEC-004 7.1) */
import { describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import type { DatabaseContext, NodeConfig, WorkflowEdgeInput, WorkflowNodeInput } from '@easter-workflow-builder/db';
import { openDatabase } from '@easter-workflow-builder/db';
import type { AgentQueryRunner } from '@easter-workflow-builder/agent';
import type {
  Fact,
  ModelDescriptor,
  ProviderCapabilityDescriptor,
  ProviderId,
} from '@easter-workflow-builder/provider-capability';
import { createConcurrencyGate } from '../concurrency-gate/create-concurrency-gate.ts';
import type { EngineDependencies } from '../engine-port/engine-dependencies.ts';
import { createApprovalWaitRegistry } from '../node-executor/approval-wait-registry.ts';
import { createAgentQueryRegistry } from '../run-interrupt/agent-query-registry.ts';
import { createRunSupervisor } from '../run-supervisor/create-run-supervisor.ts';
import type { RunSupervisor } from '../run-supervisor/run-supervisor.ts';
import { runStartupRecovery } from './run-startup-recovery.ts';

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (!isOkOutcome(outcome)) {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

function openMemoryDatabase(): DatabaseContext {
  return okOrThrow(openDatabase(':memory:'));
}

function startNodeConfig(): NodeConfig {
  return { type: 'start', inputFields: [], onUnhandledError: 'fail_run' };
}

function nodeOf(id: string, config: NodeConfig): WorkflowNodeInput {
  return { id, label: id, positionX: 0, positionY: 0, config };
}

/**
 * A legkisebb futtatható gráf: egyetlen `start` node, él nélkül. A SPEC-004
 * 4.7 táblázat egyetlen ellenőrzése sem igényel több node-ot vagy élt (a
 * `start` triviálisan eléri önmagát), tehát ez a gráf indítható.
 */
function createTrivialWorkflow(database: DatabaseContext): string {
  const workflow = okOrThrow(
    database.workflows.createWorkflow({ name: 'triviális', description: null, providerId: null }),
  );
  const nodes: readonly WorkflowNodeInput[] = [nodeOf('start', startNodeConfig())];
  const edges: readonly WorkflowEdgeInput[] = [];
  okOrThrow(database.workflows.replaceGraph(workflow.id, nodes, edges));
  return workflow.id;
}

/**
 * Egy teljes `RunSupervisor`, csak annyi funkcionalitással, hogy egy `start`
 * node-ból álló, triviális gráfot végig tudjon futtatni. A kilenc port közül
 * három (`agentQueryRunner`, `expressionEvaluator`, `templateRenderer`) SOSEM
 * hívódik egy ilyen gráfra - a `throw` ezt a feltevést a teszt hibájaként
 * buktatná meg, ha mégis hívódnának. A `providerDescriptorLookup` viszont
 * MINDEN node típusra hívódik (a `buildNodePlans` a leírót a tervbe teszi),
 * tehát azt egy minimális, valós leíróval kell kiszolgálni.
 */
function neverCalled(): never {
  throw new Error('nem várt hívás: ez a port egy start-only gráfnál sosem hívódik');
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

function createTrivialSupervisor(database: DatabaseContext): RunSupervisor {
  const agentQueryRunner: AgentQueryRunner = { run: neverCalled };
  const ports: EngineDependencies = {
    database,
    agentQueryRunner,
    providerDescriptorLookup: descriptorOf,
    expressionEvaluator: { evaluate: neverCalled, compile: neverCalled },
    templateRenderer: { render: neverCalled, compile: neverCalled },
    // eslint-disable-next-line @typescript-eslint/no-empty-function -- a teszt nem a kimenő eseményeket vizsgálja, csak a port jelenlétét igényli
    eventPublisher: { publish: () => {} },
    clock: { nowMs: () => 0, sleep: () => Promise.resolve() },
    idGenerator: { nextId: () => 'id-1' },
    processEnvironment: { read: () => null },
  };
  okOrThrow(database.settings.setDefaultProvider('minimax'));
  return createRunSupervisor({
    ports,
    concurrencyGate: createConcurrencyGate(() => null),
    approvalRegistry: createApprovalWaitRegistry(),
    agentQueryRegistry: createAgentQueryRegistry(),
    installedAgentSdkVersion: '0.0.0-teszt',
  });
}

describe('runStartupRecovery', () => {
  it('a database.recovery.recoverInterruptedRuns(startup_recovery) hívást burkolja, változatlan Outcome-mal', () => {
    const database = openMemoryDatabase();
    const workflow = okOrThrow(database.workflows.createWorkflow({ name: 'w', description: null, providerId: null }));
    const nodes = [nodeOf('start', startNodeConfig())];
    okOrThrow(database.workflows.replaceGraph(workflow.id, nodes, []));
    const started = okOrThrow(
      database.runs.startRun({
        workflowId: workflow.id,
        input: {},
        providerId: 'minimax',
        graphSnapshotDocument: {
          version: 1,
          sdkVersionPin: '0.0.0-teszt',
          workflow: { id: workflow.id, name: workflow.name, description: null },
          nodes: [],
          edges: [],
        },
      }),
    );

    const result = okOrThrow(runStartupRecovery(database));
    expect(result.recoveredRunCount).toBe(1);

    const runRow = okOrThrow(database.runs.getRun(started.id));
    expect(runRow.status).toBe('interrupted');

    const events = okOrThrow(database.events.readEventsSince(started.id, 0, 10));
    const interrupted = events.filter((event) => event.kind === 'run_interrupted');
    expect(interrupted).toHaveLength(1);
    expect(interrupted[0]?.payload).toStrictEqual({ reason: 'startup_recovery' });

    database.close();
  });

  it('nulla érintett futásnál is a database.recovery hibaágát/eredményét változatlanul adja vissza', () => {
    const database = openMemoryDatabase();

    const result = okOrThrow(runStartupRecovery(database));
    expect(result.recoveredRunCount).toBe(0);

    database.close();
  });

  it('STRUKTURÁLIS bizonyíték: a startRun egy MÁR helyreállított DatabaseContext-tel helyesen működik (AC-53)', async () => {
    const database = openMemoryDatabase();

    // A `apps/server` sorrendje: előbb a helyreállítás, csak utána bármilyen
    // motor művelet (SPEC-004 10.1 szekció). Itt üres adatbázison fut, mert a
    // cél nem a helyreállítás tartalmának ismételt bizonyítása (azt a fenti
    // teszt már megteszi), hanem az, hogy a rá épülő `RunSupervisor.startRun`
    // ZAVARTALANUL működik egy már átment `DatabaseContext` fölött - vagyis a
    // két hívás komponálható, ahogy az `apps/server` majd tenni fogja.
    okOrThrow(runStartupRecovery(database));

    const workflowId = createTrivialWorkflow(database);
    const supervisor = createTrivialSupervisor(database);

    const started = okOrThrow(supervisor.startRun({ workflowId, input: {} }));
    const handle = supervisor.getActiveRun(started.run.id);
    if (handle === undefined) {
      throw new Error('a futáshoz nincs aktív kézikönyv');
    }
    okOrThrow(await handle.completion);

    expect(okOrThrow(database.runs.getRun(started.run.id)).status).toBe('succeeded');

    database.close();
  });
});
