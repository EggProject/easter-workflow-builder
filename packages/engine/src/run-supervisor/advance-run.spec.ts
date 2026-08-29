/* eslint-disable unicorn/no-null -- a node configok, a `SnapshotEdge` és a `Fact<T | null>` nullázható mezői (SPEC-003 4.3, 5.1, SPEC-000 5.) valódi `null` értéket hordoznak */
import { describe, expect, it } from 'vitest';
import type { AgentQueryRunner } from '@easter-workflow-builder/agent';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import type {
  DatabaseContext,
  GraphSnapshotDocument,
  NodeConfig,
  SnapshotEdge,
  SnapshotNode,
} from '@easter-workflow-builder/db';
import { openDatabase } from '@easter-workflow-builder/db';
import type {
  Fact,
  ModelDescriptor,
  ProviderCapabilityDescriptor,
  ProviderId,
} from '@easter-workflow-builder/provider-capability';
import { collectSessionSourceNodes } from '../agent-step/collect-session-source-nodes.ts';
import { createConcurrencyGate } from '../concurrency-gate/create-concurrency-gate.ts';
import type { ClockPort } from '../engine-port/clock-port.ts';
import type { EngineDependencies } from '../engine-port/engine-dependencies.ts';
import { createApprovalWaitRegistry } from '../node-executor/approval-wait-registry.ts';
import type { NodeExecutorDependencies } from '../node-executor/node-executor-dependencies.ts';
import { createAgentQueryRegistry } from '../run-interrupt/agent-query-registry.ts';
import { validateRun } from '../run-validation/validate-run.ts';
import { createSchedulerState } from '../scheduling/create-scheduler-state.ts';
import { enqueueStartInstance } from '../scheduling/enqueue-start-instance.ts';
import { advanceRun } from './advance-run.ts';
import { buildNodePlans } from './build-node-plans.ts';
import type { NodePlan, RunExecution } from './run-execution.ts';

const INSTALLED = '0.0.0-teszt';

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (!isOkOutcome(outcome)) {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
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

function node(id: string, config: NodeConfig): SnapshotNode {
  return { id, type: config.type, label: id, position: { x: 0, y: 0 }, config, effectiveProviderId: 'minimax' };
}
function edge(id: string, sourceNodeId: string, targetNodeId: string): SnapshotEdge {
  return { id, sourceNodeId, targetNodeId, sourceHandle: null, targetHandle: null, branchKey: null };
}

const START: NodeConfig = { type: 'start', inputFields: [], onUnhandledError: 'fail_run' };
const HANDLER: NodeConfig = {
  type: 'error_handler',
  maxAttempts: 2,
  backoffMs: [1],
  handledErrorKinds: [],
  onUnhandledError: 'fail_run',
};

// A gráf szándékosan `on_error` él NÉLKÜL vezet az `error_handler` node-hoz: a
// 4.7 validáció csak az `on_error` élek CÉLJÁT köti error_handler node-hoz, a
// fordítottját nem, tehát ez érvényes gráf - a kezelőnek viszont nincs
// hibakontextusa, amikor futtathatóvá válik.
const DOCUMENT: GraphSnapshotDocument = {
  version: 1,
  sdkVersionPin: INSTALLED,
  workflow: { id: 'wf', name: 'teszt', description: null },
  nodes: [node('start', START), node('eh', HANDLER)],
  edges: [edge('e1', 'start', 'eh')],
};

const FAILING_BRANCH: NodeConfig = {
  type: 'branch',
  expression: 'HIBA',
  branches: [{ key: 'a', label: 'a' }],
  defaultBranchKey: null,
  onUnhandledError: 'fail_run',
};

// A hibára futó `branch` node `on_error` éle a kezelőhöz vezet, tehát a kezelő
// VALÓDI hibakontextussal indul - a teszt ezt a kontextust veszi ki alóla a
// backoff várakozás alatt.
const RETRY_DOCUMENT: GraphSnapshotDocument = {
  version: 1,
  sdkVersionPin: INSTALLED,
  workflow: { id: 'wf', name: 'teszt', description: null },
  nodes: [node('start', START), node('br', FAILING_BRANCH), node('eh', HANDLER)],
  edges: [
    edge('e1', 'start', 'br'),
    { id: 'e2', sourceNodeId: 'br', targetNodeId: 'eh', sourceHandle: null, targetHandle: null, branchKey: 'on_error' },
  ],
};

interface Fixture {
  readonly database: DatabaseContext;
  readonly execution: RunExecution;
  readonly dependencies: NodeExecutorDependencies;
}

interface FixtureOptions {
  readonly document?: GraphSnapshotDocument;
  readonly runId?: string;
  readonly nodePlans?: ReadonlyMap<string, NodePlan>;
  readonly enqueueStart?: boolean;
  readonly onNowMs?: () => void;
  readonly onSleep?: () => void;
}

function openFixture(options: FixtureOptions = {}): Fixture {
  const database = okOrThrow(openDatabase(':memory:'));
  okOrThrow(database.settings.setDefaultProvider('minimax'));
  const workflow = okOrThrow(database.workflows.createWorkflow({ name: 'teszt', description: null, providerId: null }));
  const document = options.document ?? DOCUMENT;
  const validated = okOrThrow(validateRun(document, 'minimax', null));
  const plans = okOrThrow(buildNodePlans(validated, descriptorOf));
  const run = okOrThrow(
    database.runs.startRun({
      workflowId: workflow.id,
      input: {},
      providerId: 'minimax',
      graphSnapshotDocument: document,
    }),
  );
  okOrThrow(database.runs.markRunRunning(run.id));

  let now = 0;
  const clock: ClockPort = {
    nowMs: () => {
      options.onNowMs?.();
      now += 1;
      return now;
    },
    sleep: () => {
      options.onSleep?.();
      return Promise.resolve();
    },
  };
  const runner: AgentQueryRunner = { run: notCalled };
  const ports: EngineDependencies = {
    database,
    agentQueryRunner: runner,
    providerDescriptorLookup: descriptorOf,
    expressionEvaluator: {
      evaluate: (expression) => ({ kind: 'error', message: `a(z) ${expression} kifejezés kiértékelése elhasalt` }),
      compile: notCalled,
    },
    templateRenderer: { render: notCalled, compile: notCalled },
    // eslint-disable-next-line @typescript-eslint/no-empty-function -- a teszt nem a kimenő eseményeket vizsgálja, csak a port jelenlétét igényli
    eventPublisher: { publish: () => {} },
    clock,
    idGenerator: { nextId: notCalled },
    processEnvironment: { read: () => null },
  };
  const dependencies: NodeExecutorDependencies = {
    ports,
    concurrencyGate: createConcurrencyGate(() => null),
    approvalRegistry: createApprovalWaitRegistry(),
    childWorkflowRunner: { startChildRun: notCalled, awaitChildRun: notCalled },
    agentQueryRegistry: createAgentQueryRegistry(),
  };

  const scheduler =
    options.enqueueStart === false ? createSchedulerState() : enqueueStartInstance(createSchedulerState(), 'start');
  const execution: RunExecution = {
    runId: options.runId ?? run.id,
    topology: validated,
    nodePlans: options.nodePlans ?? plans,
    sessionSourceNodes: collectSessionSourceNodes(validated.nodeConfigsById),
    runInput: {},
    scheduler,
    executedInstances: [],
    sessionInstances: [],
    unhandledErrors: [],
    pendingFailures: new Map(),
    retryAttempts: new Map(),
    failRunRequested: false,
    stopRequested: false,
  };
  return { database, execution, dependencies };
}

describe('advanceRun', () => {
  it('hiányzó végrehajtási terv esetén run_execution_failed, és a futás failed állapotban zár', async () => {
    const fixture = openFixture({ nodePlans: new Map() });

    const outcome = await advanceRun(fixture.execution, fixture.dependencies);

    expect(outcome.kind === 'error' ? outcome.message : '').toContain('run_execution_failed');
    const run = okOrThrow(fixture.database.runs.getRun(fixture.execution.runId));
    expect(run.status).toBe('failed');
    expect(run.errorKind).toBe('run_execution_failed');
  });

  it('hibakontextus nélküli error_handler példány esetén run_execution_failed', async () => {
    const fixture = openFixture();

    const outcome = await advanceRun(fixture.execution, fixture.dependencies);

    expect(outcome.kind === 'error' ? outcome.message : '').toContain('run_execution_failed');
    expect(outcome.kind === 'error' ? outcome.message : '').toContain('nincs hozzá hibakontextus');
  });

  it('a végrehajtó Outcome hibaágát a futás léptetése továbbadja', async () => {
    const fixture = openFixture({ runId: 'nincs-ilyen-futas' });

    const outcome = await advanceRun(fixture.execution, fixture.dependencies);

    expect(outcome.kind).toBe('error');
  });

  it('külső leállítás után nem indul lépés, és a záró állapotot nem a hurok írja', async () => {
    const fixture = openFixture();
    fixture.execution.stopRequested = true;

    const completion = okOrThrow(await advanceRun(fixture.execution, fixture.dependencies));

    expect(completion.status).toBe('succeeded');
    expect(okOrThrow(fixture.database.runs.getRun(fixture.execution.runId)).status).toBe('running');
    expect(okOrThrow(fixture.database.stepRuns.listStepRuns(fixture.execution.runId))).toStrictEqual([]);
  });

  it('eltűnt hibakontextus esetén a megismételt lépés ütemezése run_execution_failed', async () => {
    const holder: { execution?: RunExecution } = {};
    const fixture = openFixture({
      document: RETRY_DOCUMENT,
      onSleep: () => {
        holder.execution?.pendingFailures.clear();
      },
    });
    holder.execution = fixture.execution;

    const outcome = await advanceRun(fixture.execution, fixture.dependencies);

    expect(outcome.kind === 'error' ? outcome.message : '').toContain('run_execution_failed');
    expect(outcome.kind === 'error' ? outcome.message : '').toContain('nem tartozik hibakontextus');
  });

  it('a záró állapotváltás hibáját továbbadja (a futás már terminális)', async () => {
    const fixture = openFixture({ enqueueStart: false });
    okOrThrow(fixture.database.runs.markRunSucceeded(fixture.execution.runId));

    const outcome = await advanceRun(fixture.execution, fixture.dependencies);

    expect(outcome.kind).toBe('error');
  });

  it('a run_finished esemény írásának hibáját továbbadja', async () => {
    const fixture = openFixture({
      enqueueStart: false,
      onNowMs: () => {
        fixture.database.close();
      },
    });

    const outcome = await advanceRun(fixture.execution, fixture.dependencies);

    expect(outcome.kind).toBe('error');
  });
});
