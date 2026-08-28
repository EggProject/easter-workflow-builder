/* eslint-disable unicorn/no-null -- a node configok, a `SnapshotNode`/`SnapshotEdge` és a `Fact<T | null>` nullázható mezői (SPEC-003 4.3, 5.1, SPEC-000 5.) valódi `null` értéket hordoznak */
import { describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import type {
  AgentStepConfig,
  GraphSnapshotDocument,
  NodeConfig,
  SnapshotEdge,
  SnapshotNode,
} from '@easter-workflow-builder/db';
import type {
  Fact,
  ModelDescriptor,
  ProviderCapabilityDescriptor,
  ProviderId,
} from '@easter-workflow-builder/provider-capability';
import { validateRun } from '../run-validation/validate-run.ts';
import type { ValidatedRun } from '../run-validation/validated-run.ts';
import { prepareRun } from './prepare-run.ts';

const INSTALLED = '0.0.0-teszt';

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
  return { id, type: config.type, label: id, position: { x: 0, y: 0 }, config, effectiveProviderId: 'minimax' };
}
function edge(id: string, sourceNodeId: string, targetNodeId: string): SnapshotEdge {
  return { id, sourceNodeId, targetNodeId, sourceHandle: null, targetHandle: null, branchKey: null };
}

function agentStepConfig(overrides: Partial<AgentStepConfig> = {}): AgentStepConfig {
  return {
    promptTemplate: 'sikeres',
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

const DOCUMENT: GraphSnapshotDocument = {
  version: 1,
  sdkVersionPin: INSTALLED,
  workflow: { id: 'wf', name: 'teszt', description: null },
  nodes: [
    node('start', {
      type: 'start',
      inputFields: [{ name: 'tema', label: 'Téma', valueKind: 'string', required: true }],
      onUnhandledError: 'fail_run',
    }),
    node('ag', { type: 'agent_step', onUnhandledError: 'fail_run', ...agentStepConfig() }),
  ],
  edges: [edge('e1', 'start', 'ag')],
};

const VALIDATED: ValidatedRun = okOrThrow(validateRun(DOCUMENT, 'minimax', null));

function mismatchedLookup(id: ProviderId): ProviderCapabilityDescriptor<string, string> {
  return { ...descriptorOf(id), sdkVersionPin: '9.9.9-masik' };
}

describe('prepareRun', () => {
  it('érvényes futásnál node-onkénti tervet ad', () => {
    const plans = okOrThrow(
      prepareRun({
        validated: VALIDATED,
        descriptorLookup: descriptorOf,
        installedAgentSdkVersion: INSTALLED,
        input: { tema: 'x' },
      }),
    );

    expect(plans.keys().toArray()).toStrictEqual(['start', 'ag']);
  });

  it('a node terv hibája megy tovább (hiányzó feloldott provider)', () => {
    const broken: ValidatedRun = { ...VALIDATED, effectiveProviderByNodeId: new Map<string, ProviderId>() };

    const outcome = prepareRun({
      validated: broken,
      descriptorLookup: descriptorOf,
      installedAgentSdkVersion: INSTALLED,
      input: { tema: 'x' },
    });

    expect(outcome.kind === 'error' ? outcome.message : '').toContain('no_default_provider');
  });

  it('a leíró alapú ellenőrzés hibája megy tovább (SDK verzió eltérés)', () => {
    const outcome = prepareRun({
      validated: VALIDATED,
      descriptorLookup: mismatchedLookup,
      installedAgentSdkVersion: INSTALLED,
      input: { tema: 'x' },
    });

    expect(outcome.kind === 'error' ? outcome.message : '').toContain('provider_descriptor_sdk_mismatch');
  });

  it('a bemenet ellenőrzésének hibája megy tovább (hiányzó kötelező mező)', () => {
    const outcome = prepareRun({
      validated: VALIDATED,
      descriptorLookup: descriptorOf,
      installedAgentSdkVersion: INSTALLED,
      input: {},
    });

    expect(outcome.kind === 'error' ? outcome.message : '').toContain('missing_required_input');
  });
});
