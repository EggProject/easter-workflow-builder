/* eslint-disable unicorn/no-null -- a `GraphSnapshotDocument.workflow.description` és a `RunCompletion` `succeeded` ágának mezői (SPEC-003 5.1, error-policy/run-completion.ts) itt tárolt `null` értéket hordoznak, nem helyőrző `undefined`-et */
import { describe, expect, it, vi } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import type {
  DatabaseContext,
  GraphSnapshotDocument,
  NodeConfig,
  WorkflowEdgeInput,
  WorkflowNodeInput,
} from '@easter-workflow-builder/db';
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
import { createRunSupervisor } from './create-run-supervisor.ts';
import { restartRun } from './restart-run.ts';
import type { RestartRunDependencies } from './restart-run.ts';
import type { RunSupervisor, StartedRun } from './run-supervisor.ts';

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (!isOkOutcome(outcome)) {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

function openMemoryDatabase(): DatabaseContext {
  return okOrThrow(openDatabase(':memory:'));
}

function snapshotOf(workflowId: string, workflowName: string): GraphSnapshotDocument {
  return {
    version: 1,
    sdkVersionPin: '0.0.0-teszt',
    workflow: { id: workflowId, name: workflowName, description: null },
    nodes: [],
    edges: [],
  };
}

function seedOriginalRun(database: DatabaseContext, input: unknown): { workflowId: string; runId: string } {
  const workflow = okOrThrow(
    database.workflows.createWorkflow({ name: 'eredeti', description: null, providerId: null }),
  );
  const run = okOrThrow(
    database.runs.startRun({
      workflowId: workflow.id,
      input,
      providerId: 'minimax',
      graphSnapshotDocument: snapshotOf(workflow.id, workflow.name),
    }),
  );
  return { workflowId: workflow.id, runId: run.id };
}

const SUCCEEDED_START: Outcome<StartedRun> = {
  kind: 'ok',
  value: {
    run: {
      id: 'uj-futas',
      workflowId: 'w',
      status: 'running',
      input: {},
      providerId: 'minimax',
      rootRunId: 'uj-futas',
      depth: 0,
      workflowAncestry: ['w'],
      graphSnapshotHash: 'hash',
      persistedStreamDeltas: false,
      restartedFromRunId: null,
      createdAtMs: new Date(0),
      startedAtMs: new Date(0),
      finishedAtMs: null,
      errorKind: null,
      errorMessage: null,
    },
  },
};

describe('restartRun', () => {
  it('ismeretlen runId-ra a not_found hiba változatlanul az Outcome hibaágán jelenik meg, a runSupervisor.startRun hívása nélkül', async () => {
    const database = openMemoryDatabase();
    const startRun = vi.fn();
    const dependencies: RestartRunDependencies = { database, runSupervisor: { startRun } };

    const outcome = await restartRun('nincs-ilyen-futas', dependencies);

    expect(outcome.kind).toBe('error');
    expect(outcome.kind === 'error' ? outcome.message : '').toContain('not_found');
    expect(startRun).not.toHaveBeenCalled();

    database.close();
  });

  it('nem rekord alakú eredeti bemenetre malformed_restart_source_input hibát ad, a runSupervisor.startRun hívása nélkül', async () => {
    const database = openMemoryDatabase();
    const seeded = seedOriginalRun(database, 'nem-rekord-string');
    const startRun = vi.fn();
    const dependencies: RestartRunDependencies = { database, runSupervisor: { startRun } };

    const outcome = await restartRun(seeded.runId, dependencies);

    expect(outcome.kind).toBe('error');
    expect(outcome.kind === 'error' ? outcome.message : '').toContain('malformed_restart_source_input');
    expect(startRun).not.toHaveBeenCalled();

    database.close();
  });

  it('az eredeti futás workflowId-jét és input-ját adja tovább a runSupervisor.startRun-nak, a restartedFromRunId mezővel kiegészítve', async () => {
    const database = openMemoryDatabase();
    const seeded = seedOriginalRun(database, { tema: 'nyuszi' });
    const startRun = vi.fn(() => SUCCEEDED_START);
    const dependencies: RestartRunDependencies = { database, runSupervisor: { startRun } };

    const outcome = okOrThrow(await restartRun(seeded.runId, dependencies));

    expect(outcome).toStrictEqual(SUCCEEDED_START.value);
    expect(startRun).toHaveBeenCalledTimes(1);
    expect(startRun).toHaveBeenCalledWith({
      workflowId: seeded.workflowId,
      input: { tema: 'nyuszi' },
      restartedFromRunId: seeded.runId,
    });

    database.close();
  });

  it('a runSupervisor.startRun hibaága változatlanul az Outcome hibaágán jelenik meg', async () => {
    const database = openMemoryDatabase();
    const seeded = seedOriginalRun(database, {});
    const startRun = vi.fn((): Outcome<StartedRun> => ({
      kind: 'error',
      message: 'nincs alapértelmezett provider (no_default_provider).',
    }));
    const dependencies: RestartRunDependencies = { database, runSupervisor: { startRun } };

    const outcome = await restartRun(seeded.runId, dependencies);

    expect(outcome.kind).toBe('error');
    expect(outcome.kind === 'error' ? outcome.message : '').toContain('no_default_provider');

    database.close();
  });
});

// --- Valós, teljes RunSupervisor-t használó integrációs teszt ---

function startNodeConfig(): NodeConfig {
  return { type: 'start', inputFields: [], onUnhandledError: 'fail_run' };
}
function nodeOf(id: string, config: NodeConfig): WorkflowNodeInput {
  return { id, label: id, positionX: 0, positionY: 0, config };
}

function neverCalled(): never {
  throw new Error('nem várt hívás: ez a port egy start-only gráfnál sosem hívódik');
}

// A `providerDescriptorLookup`-ot a `buildNodePlans` MINDEN node típusra
// meghívja (a leírót a tervbe teszi, `run-supervisor/build-node-plans.ts`),
// tehát egy `start`-only gráfnál sem `neverCalled` - ellentétben a másik
// három, valóban sosem hívott porttal. A minimális leíró ugyanaz a fixture,
// mint a `create-run-supervisor.spec.ts`-ben.
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
  return createRunSupervisor({
    ports,
    concurrencyGate: createConcurrencyGate(() => null),
    approvalRegistry: createApprovalWaitRegistry(),
    agentQueryRegistry: createAgentQueryRegistry(),
    installedAgentSdkVersion: '0.0.0-teszt',
  });
}

async function runToEnd(supervisor: RunSupervisor, runId: string): Promise<void> {
  const handle = supervisor.getActiveRun(runId);
  if (handle === undefined) {
    throw new Error(`a(z) ${runId} futáshoz nincs aktív kézikönyv`);
  }
  okOrThrow(await handle.completion);
}

describe('restartRun - valós RunSupervisor-ral (AC-55, SPEC-003 27. kritérium)', () => {
  it('a workflow AKTUÁLIS gráfjáról készít új pillanatképet, nem az eredeti futáséról, és rögzíti a restartedFromRunId származást', async () => {
    const database = openMemoryDatabase();
    okOrThrow(database.settings.setDefaultProvider('minimax'));
    const supervisor = createTrivialSupervisor(database);

    const workflow = okOrThrow(
      database.workflows.createWorkflow({ name: 'ujrainditando', description: null, providerId: null }),
    );
    const originalNodes = [nodeOf('start-v1', startNodeConfig())];
    okOrThrow(database.workflows.replaceGraph(workflow.id, originalNodes, []));

    const original = okOrThrow(supervisor.startRun({ workflowId: workflow.id, input: { tema: 'nyuszi' } }));
    await runToEnd(supervisor, original.run.id);
    const originalRow = okOrThrow(database.runs.getRun(original.run.id));
    expect(originalRow.status).toBe('succeeded');

    // A gráf megváltozik az eredeti futás óta: más node azonosító, tehát más
    // pillanatkép lenyomat (SPEC-004 4.1 szekció).
    const edges: readonly WorkflowEdgeInput[] = [];
    const changedNodes = [nodeOf('start-v2', startNodeConfig())];
    okOrThrow(database.workflows.replaceGraph(workflow.id, changedNodes, edges));

    const restarted = okOrThrow(await restartRun(original.run.id, { database, runSupervisor: supervisor }));
    await runToEnd(supervisor, restarted.run.id);

    expect(restarted.run.id).not.toBe(original.run.id);
    expect(restarted.run.workflowId).toBe(workflow.id);
    expect(restarted.run.restartedFromRunId).toBe(original.run.id);
    expect(restarted.run.input).toStrictEqual({ tema: 'nyuszi' });
    // A pillanatkép lenyomata eltér: az újraindítás a MEGVÁLTOZOTT gráfra épül.
    expect(restarted.run.graphSnapshotHash).not.toBe(originalRow.graphSnapshotHash);

    const restartedRow = okOrThrow(database.runs.getRun(restarted.run.id));
    expect(restartedRow.status).toBe('succeeded');
    expect(restartedRow.restartedFromRunId).toBe(original.run.id);

    database.close();
  });
});
