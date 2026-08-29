/* eslint-disable unicorn/no-null -- a node configok, a `CreateStepRunInput` és a `Fact<T | null>` nullázható mezői (SPEC-003 4.3, 9.2, SPEC-000 5.) a tárolt/mért alakban valódi `null` értéket hordoznak, nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import type { AgentQueryRunner } from '@easter-workflow-builder/agent';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import type { AgentStepConfig, DatabaseContext, StepRunRecord } from '@easter-workflow-builder/db';
import { openDatabase } from '@easter-workflow-builder/db';
import type { Fact, ModelDescriptor, ProviderCapabilityDescriptor } from '@easter-workflow-builder/provider-capability';
import type { ConcurrencyGate } from '../concurrency-gate/concurrency-gate.ts';
import type { EngineDependencies } from '../engine-port/engine-dependencies.ts';
import { buildExecutableGraph } from '../run-graph/build-executable-graph.ts';
import type { ExecutableGraph } from '../run-graph/executable-graph.ts';
import type { RunContext } from '../run-context/run-context.ts';
import { createAgentQueryRegistry } from '../run-interrupt/agent-query-registry.ts';
import { createApprovalWaitRegistry, type ApprovalWaitRegistry } from './approval-wait-registry.ts';
import type { ChildWorkflowRunner } from './child-workflow-runner.ts';
import { executeNode } from './execute-node.ts';
import type { ExecuteNodeRequest } from './execute-node-request.ts';
import type { NodeExecutorDependencies } from './node-executor-dependencies.ts';

type PlainNodeConfig = ExecuteNodeRequest extends infer TRequest
  ? TRequest extends { readonly kind: 'node'; readonly config: infer TConfig }
    ? TConfig
    : never
  : never;

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (!isOkOutcome(outcome)) {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

const notCalled = (): never => {
  throw new Error('ebben a tesztben nem hívott port');
};

function openMemoryDatabase(): DatabaseContext {
  return okOrThrow(openDatabase(':memory:'));
}

interface SeededRun {
  readonly runId: string;
  readonly workflowId: string;
}

function seedRun(database: DatabaseContext): SeededRun {
  const workflow = okOrThrow(
    database.workflows.createWorkflow({ name: 'execute-node teszt', description: null, providerId: null }),
  );
  const run = okOrThrow(
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
  return { runId: run.id, workflowId: workflow.id };
}

const graph: ExecutableGraph = buildExecutableGraph({
  version: 1,
  sdkVersionPin: '0.0.0-teszt',
  workflow: { id: 'wf', name: 'teszt', description: null },
  nodes: [],
  edges: [],
});

const emptyRunContext: RunContext = {
  input: {},
  steps: {},
  item: undefined,
  itemIndex: undefined,
  iteration: undefined,
  joinInputs: undefined,
  error: undefined,
};

// A hamis kifejezés kiértékelő a kifejezés SZÖVEGÉBŐL dönt, hogy a három
// kifejezést fogyasztó node típus (`branch`, `fan_out`, `loop`) mindegyike
// ugyanabból a portból kapja a maga alakú eredményét.
function evaluate(expression: string): Outcome<unknown> {
  switch (expression) {
    case 'agkulcs': {
      return { kind: 'ok', value: 'igen' };
    }
    case 'elemek': {
      return { kind: 'ok', value: [1, 2] };
    }
    default: {
      return { kind: 'ok', value: true };
    }
  }
}

function enginePorts(database: DatabaseContext, published: unknown[], runner: AgentQueryRunner): EngineDependencies {
  let now = 0;
  return {
    database,
    agentQueryRunner: runner,
    providerDescriptorLookup: notCalled,
    expressionEvaluator: { evaluate, compile: notCalled },
    templateRenderer: { render: (template) => ({ kind: 'ok', value: `renderelt: ${template}` }), compile: notCalled },
    eventPublisher: {
      publish: (event) => {
        published.push(event);
      },
    },
    clock: {
      nowMs: () => {
        now += 5;
        return now;
      },
      sleep: () => Promise.resolve(),
    },
    idGenerator: { nextId: notCalled },
    processEnvironment: { read: () => null },
  };
}

const failingRunner: AgentQueryRunner = { run: () => ({ kind: 'error', message: 'teszt provider hiba' }) };

function openGate(): ConcurrencyGate {
  return {
    requestSlot: (_providerId, _requestId, onGranted) => {
      onGranted();
    },
    releaseSlot: () => ({ kind: 'ok', value: undefined }),
    occupiedSlotCount: () => 0,
    waitingRequestCount: () => 0,
  };
}

function registryDecidingImmediately(database: DatabaseContext): ApprovalWaitRegistry {
  const real = createApprovalWaitRegistry();
  return {
    waitForDecision: (stepRunId) => {
      const pending = real.waitForDecision(stepRunId);
      queueMicrotask(() => {
        okOrThrow(database.approvals.decideApproval({ stepRunId, decision: 'approved' }));
        real.notifyDecided(stepRunId, 'approved');
      });
      return pending;
    },
    notifyDecided: (stepRunId, decision) => {
      real.notifyDecided(stepRunId, decision);
    },
    cancelWait: (stepRunId) => {
      real.cancelWait(stepRunId);
    },
  };
}

const notCalledRunner: ChildWorkflowRunner = { startChildRun: notCalled, awaitChildRun: notCalled };

function dependenciesOf(
  database: DatabaseContext,
  published: unknown[],
  options: { readonly runner?: AgentQueryRunner; readonly approvalRegistry?: ApprovalWaitRegistry } = {},
): NodeExecutorDependencies {
  return {
    ports: enginePorts(database, published, options.runner ?? failingRunner),
    concurrencyGate: openGate(),
    approvalRegistry: options.approvalRegistry ?? createApprovalWaitRegistry(),
    childWorkflowRunner: notCalledRunner,
    agentQueryRegistry: createAgentQueryRegistry(),
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

function agentStepConfig(): AgentStepConfig {
  return {
    promptTemplate: 'kerdes',
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

function plainRequest(runId: string, nodeId: string, config: PlainNodeConfig): ExecuteNodeRequest {
  return {
    kind: 'node',
    config,
    instance: {
      runId,
      instance: { nodeId, branchContext: [] },
      parentStepRunId: null,
      iteration: 0,
      attempt: 1,
      providerId: 'minimax',
    },
    runContext: emptyRunContext,
    graph,
    executedInstances: [],
    runInput: { bemenet: 42 },
    availableBranchKeys: ['igen', 'nem'],
    joinInputs: ['elso', 'masodik'],
    descriptor: descriptor(),
    sessionSourceNodes: { sourceNodeIds: new Set(), continuedNodeIds: new Set() },
    sessionInstances: [],
  };
}

function runStepRuns(database: DatabaseContext, runId: string): readonly StepRunRecord[] {
  return okOrThrow(database.stepRuns.listStepRuns(runId));
}

describe('executeNode', () => {
  it('start ágon az executeStart fut: a step_run node_type start, a kimenet a futás bemenete', async () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const request = plainRequest(runId, 'start', { type: 'start', inputFields: [], onUnhandledError: 'fail_run' });

    const outcome = okOrThrow(await executeNode(request, dependenciesOf(database, [])));

    expect(outcome.kind).toBe('succeeded');
    expect(outcome.stepRun.nodeType).toBe('start');
    expect(outcome.stepRun.output).toStrictEqual({ bemenet: 42 });
  });

  it('branch ágon az executeBranch fut: a kiválasztott ág kulcsa jelenik meg a kimenetben', async () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const request = plainRequest(runId, 'ag', {
      type: 'branch',
      expression: 'agkulcs',
      branches: [{ key: 'igen', label: 'igen' }],
      defaultBranchKey: null,
      onUnhandledError: 'fail_run',
    });

    const outcome = okOrThrow(await executeNode(request, dependenciesOf(database, [])));

    expect(outcome.kind).toBe('succeeded');
    expect(outcome.kind === 'succeeded' ? outcome.selectedBranchKey : null).toBe('igen');
    expect(outcome.stepRun.nodeType).toBe('branch');
  });

  it('fan_out ágon az executeFanOut fut: a kimenet a kiértékelt elemlista', async () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const request = plainRequest(runId, 'szetbontas', {
      type: 'fan_out',
      itemsExpression: 'elemek',
      branchLabelTemplate: 'cimke',
      onUnhandledError: 'fail_run',
    });

    const outcome = okOrThrow(await executeNode(request, dependenciesOf(database, [])));

    expect(outcome.kind).toBe('fan_out_expanded');
    expect(outcome.kind === 'fan_out_expanded' ? outcome.items : []).toStrictEqual([1, 2]);
    expect(outcome.stepRun.nodeType).toBe('fan_out');
  });

  it('loop ágon az executeLoop fut: a shouldContinue a kiértékelt logikai érték', async () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const request = plainRequest(runId, 'ciklus', {
      type: 'loop',
      maxIterations: 3,
      continueExpression: 'folytat',
      onUnhandledError: 'fail_run',
    });

    const outcome = okOrThrow(await executeNode(request, dependenciesOf(database, [])));

    expect(outcome.kind).toBe('loop_advanced');
    expect(outcome.kind === 'loop_advanced' ? outcome.shouldContinue : false).toBe(true);
    expect(outcome.stepRun.nodeType).toBe('loop');
  });

  it('join merge módban az executeJoinMerge fut: a kimenet a bemenetek listája', async () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const request = plainRequest(runId, 'osszefuzes', {
      type: 'join',
      mode: 'merge',
      settings: {},
      onUnhandledError: 'fail_run',
    });

    const outcome = okOrThrow(await executeNode(request, dependenciesOf(database, [])));

    expect(outcome.kind).toBe('succeeded');
    expect(outcome.stepRun.output).toStrictEqual(['elso', 'masodik']);
    expect(outcome.stepRun.nodeType).toBe('join');
  });

  it('join ai_synthesis módban az executeJoinAiSynthesis fut: join_resolved esemény ai_synthesis módban', async () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const published: unknown[] = [];
    const request = plainRequest(runId, 'szintezis', {
      type: 'join',
      mode: 'ai_synthesis',
      settings: agentStepConfig(),
      onUnhandledError: 'fail_run',
    });

    const outcome = okOrThrow(await executeNode(request, dependenciesOf(database, published)));

    expect(outcome.stepRun.nodeType).toBe('join');
    expect(published).toContainEqual(
      expect.objectContaining({ kind: 'join_resolved', payload: { mode: 'ai_synthesis', inputCount: 2 } }),
    );
  });

  it('agent_step ágon az executeAgentStep fut: a step_run node_type agent_step', async () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const request = plainRequest(runId, 'agent', { type: 'agent_step', ...agentStepConfig(), onUnhandledError: null });

    const outcome = okOrThrow(await executeNode(request, dependenciesOf(database, [])));

    expect(outcome.kind).toBe('failed');
    expect(outcome.kind === 'failed' ? outcome.errorKind : '').toBe('provider_call_failed');
    expect(outcome.stepRun.nodeType).toBe('agent_step');
  });

  it('human_approval ágon az executeHumanApproval fut, a diszpécsertől kapott regiszterrel', async () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const request = plainRequest(runId, 'jovahagyas', {
      type: 'human_approval',
      title: 'Jóváhagyás',
      bodyTemplate: 'sablon',
      timeoutMs: null,
      onUnhandledError: 'fail_run',
    });
    const dependencies = dependenciesOf(database, [], { approvalRegistry: registryDecidingImmediately(database) });

    const outcome = okOrThrow(await executeNode(request, dependencies));

    expect(outcome.kind).toBe('approval_decided');
    expect(outcome.kind === 'approval_decided' ? outcome.decision : '').toBe('approved');
    expect(outcome.stepRun.nodeType).toBe('human_approval');
  });

  it('sub_workflow ágon az executeSubWorkflow fut: önmagára hivatkozva workflow_recursion_detected', async () => {
    const database = openMemoryDatabase();
    const { runId, workflowId } = seedRun(database);
    const request = plainRequest(runId, 'alfolyamat', {
      type: 'sub_workflow',
      targetWorkflowId: workflowId,
      inputMapping: {},
      onUnhandledError: 'fail_run',
    });

    const outcome = okOrThrow(await executeNode(request, dependenciesOf(database, [])));

    expect(outcome.kind).toBe('failed');
    expect(outcome.kind === 'failed' ? outcome.errorKind : '').toBe('workflow_recursion_detected');
    expect(outcome.stepRun.nodeType).toBe('sub_workflow');
  });

  it('error_handler ágon az executeErrorHandler fut, a hibát adó lépés három adatával', async () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const base = plainRequest(runId, 'kezelo', { type: 'start', inputFields: [], onUnhandledError: 'fail_run' });
    const request: ExecuteNodeRequest = {
      ...base,
      kind: 'error_handler',
      config: {
        type: 'error_handler',
        maxAttempts: 3,
        backoffMs: [100, 200],
        handledErrorKinds: [],
        onUnhandledError: 'fail_run',
      },
      failedErrorKind: 'provider_call_failed',
      failedAttempt: 1,
    };

    const outcome = okOrThrow(await executeNode(request, dependenciesOf(database, [])));

    expect(outcome.kind).toBe('retry_scheduled');
    expect(outcome.kind === 'retry_scheduled' ? outcome.nextAttempt : -1).toBe(2);
    expect(runStepRuns(database, runId).map((row) => row.nodeType)).toStrictEqual(['error_handler']);
  });

  it('a nem érintett függőségeket egyetlen ág sem hívja: a sub_workflow futtató érintetlen marad', async () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const request = plainRequest(runId, 'start', { type: 'start', inputFields: [], onUnhandledError: 'fail_run' });

    // A `notCalledRunner` mindkét metódusa dob, tehát a hívás ténye a teszt
    // bukásaként jelenne meg; a sikeres lefutás maga a bizonyíték.
    await expect(executeNode(request, dependenciesOf(database, []))).resolves.toStrictEqual(
      expect.objectContaining({ kind: 'ok' }),
    );
  });
});
