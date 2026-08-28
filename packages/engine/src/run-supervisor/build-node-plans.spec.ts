/* eslint-disable unicorn/no-null -- a `SnapshotNode`/`SnapshotEdge` és a node configok nullázható mezői (SPEC-003 4.3, 5.1) valódi `null` értéket hordoznak, és a `Fact<T | null>` mért alakja is az */
import { describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import type { GraphSnapshotDocument, NodeConfig, SnapshotEdge, SnapshotNode } from '@easter-workflow-builder/db';
import type {
  Fact,
  ModelDescriptor,
  ProviderCapabilityDescriptor,
  ProviderId,
} from '@easter-workflow-builder/provider-capability';
import type { ExecutableNodeConfig } from '../run-validation/executable-node-config.ts';
import { validateRun } from '../run-validation/validate-run.ts';
import type { ValidatedRun } from '../run-validation/validated-run.ts';
import { buildNodePlans } from './build-node-plans.ts';

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (!isOkOutcome(outcome)) {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
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

function node(id: string, config: NodeConfig): SnapshotNode {
  return {
    id,
    type: config.type,
    label: id,
    position: { x: 0, y: 0 },
    config,
    effectiveProviderId: 'minimax',
  };
}
function edge(id: string, sourceNodeId: string, targetNodeId: string, branchKey: string | null = null): SnapshotEdge {
  return { id, sourceNodeId, targetNodeId, sourceHandle: null, targetHandle: null, branchKey };
}

const START: NodeConfig = { type: 'start', inputFields: [], onUnhandledError: 'fail_run' };
const BRANCH: NodeConfig = {
  type: 'branch',
  expression: 'input.utvonal',
  branches: [
    { key: 'bal', label: 'Bal' },
    { key: 'jobb', label: 'Jobb' },
  ],
  defaultBranchKey: null,
  onUnhandledError: 'fail_branch',
};
// A `loop` node törzse és kilépő ága, egy `error_handler` az `on_error` élen,
// és egy kimenő él nélküli záró node: a gráf minden olyan alakot tartalmaz,
// amit ez a téma olvas (kulcsos élek, `on_error` él, terminális node).
const DOCUMENT: GraphSnapshotDocument = {
  version: 1,
  sdkVersionPin: '0.0.0-teszt',
  workflow: { id: 'wf', name: 'teszt', description: null },
  nodes: [
    node('start', START),
    node('elagazas', BRANCH),
    node('bal', { type: 'loop', maxIterations: 2, continueExpression: 'false', onUnhandledError: 'fail_run' }),
    node('jobb', {
      type: 'error_handler',
      maxAttempts: 1,
      backoffMs: [],
      handledErrorKinds: [],
      onUnhandledError: 'fail_run',
    }),
    node('torzs', {
      type: 'human_approval',
      title: 'Jóváhagyás',
      bodyTemplate: 'szöveg',
      timeoutMs: null,
      onUnhandledError: 'fail_run',
    }),
    node('ciklus-vege', {
      type: 'human_approval',
      title: 'Zárás',
      bodyTemplate: 'szöveg',
      timeoutMs: null,
      onUnhandledError: 'fail_run',
    }),
  ],
  edges: [
    edge('e1', 'start', 'elagazas'),
    edge('e2', 'elagazas', 'bal', 'bal'),
    edge('e3', 'elagazas', 'jobb', 'on_error'),
    edge('e4', 'bal', 'torzs', 'continue'),
    edge('e5', 'torzs', 'bal'),
    edge('e6', 'bal', 'ciklus-vege', 'exit'),
  ],
};

function validatedOf(document: GraphSnapshotDocument): ValidatedRun {
  return okOrThrow(validateRun(document, 'minimax', null));
}

describe('buildNodePlans', () => {
  it('minden node-hoz tervet ad, feloldott providerrel, leíróval és szűkített hibapolitikával', () => {
    const plans = okOrThrow(buildNodePlans(validatedOf(DOCUMENT), descriptorOf));

    expect(plans.keys().toArray()).toStrictEqual(['start', 'elagazas', 'bal', 'jobb', 'torzs', 'ciklus-vege']);
    expect(plans.get('elagazas')?.providerId).toBe('minimax');
    expect(plans.get('elagazas')?.onUnhandledError).toBe('fail_branch');
    expect(plans.get('elagazas')?.descriptor.id).toBe('minimax');
  });

  it('az availableBranchKeys a bekötött, on_error-tól különböző élek kulcsa, a null kulcsú élek nélkül', () => {
    const plans = okOrThrow(buildNodePlans(validatedOf(DOCUMENT), descriptorOf));

    expect(plans.get('elagazas')?.availableBranchKeys).toStrictEqual(['bal']);
    expect(plans.get('start')?.availableBranchKeys).toStrictEqual([]);
    expect(plans.get('bal')?.availableBranchKeys).toStrictEqual(['continue', 'exit']);
  });

  it('kimenő él nélküli node-ra üres kulcslista', () => {
    const plans = okOrThrow(buildNodePlans(validatedOf(DOCUMENT), descriptorOf));

    expect(plans.get('ciklus-vege')?.availableBranchKeys).toStrictEqual([]);
  });

  it('hiányzó feloldott provider esetén no_default_provider', () => {
    const validated = validatedOf(DOCUMENT);
    const withoutProviders: ValidatedRun = { ...validated, effectiveProviderByNodeId: new Map<string, ProviderId>() };

    const outcome = buildNodePlans(withoutProviders, descriptorOf);

    expect(outcome.kind === 'error' ? outcome.message : '').toContain('no_default_provider');
  });

  it('null onUnhandledError esetén unhandled_error_policy_missing', () => {
    const validated = validatedOf(DOCUMENT);
    const brokenConfig: ExecutableNodeConfig = { type: 'start', inputFields: [], onUnhandledError: null };
    const withNullPolicy: ValidatedRun = {
      ...validated,
      nodeConfigsById: new Map<string, ExecutableNodeConfig>([['start', brokenConfig]]),
    };

    const outcome = buildNodePlans(withNullPolicy, descriptorOf);

    expect(outcome.kind === 'error' ? outcome.message : '').toContain('unhandled_error_policy_missing');
  });
});
