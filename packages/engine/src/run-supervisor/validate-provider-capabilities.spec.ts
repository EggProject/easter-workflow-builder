/* eslint-disable unicorn/no-null -- a node configok és a `Fact<T | null>` nullázható mezői (SPEC-003 4.3, SPEC-000 5.) valódi `null` értéket hordoznak */
import { describe, expect, it } from 'vitest';
import type { AgentStepConfig } from '@easter-workflow-builder/db';
import type {
  Fact,
  ModelDescriptor,
  ProviderCapabilityDescriptor,
  ProviderId,
} from '@easter-workflow-builder/provider-capability';
import type { ExecutableNodeConfig } from '../run-validation/executable-node-config.ts';
import type { NodePlan } from './run-execution.ts';
import { validateProviderCapabilities } from './validate-provider-capabilities.ts';

const INSTALLED = '0.0.0-teszt';

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

function agentStepConfig(overrides: Partial<AgentStepConfig> = {}): AgentStepConfig {
  return {
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

function planOf(config: ExecutableNodeConfig, sdkVersionPin = INSTALLED): NodePlan {
  return {
    config,
    onUnhandledError: 'fail_run',
    providerId: 'minimax',
    descriptor: { ...descriptorOf('minimax'), sdkVersionPin },
    availableBranchKeys: [],
  };
}

const START_PLAN = planOf({ type: 'start', inputFields: [], onUnhandledError: 'fail_run' });

function agentPlan(overrides: Partial<AgentStepConfig> = {}, sdkVersionPin = INSTALLED): NodePlan {
  return planOf({ type: 'agent_step', onUnhandledError: 'fail_run', ...agentStepConfig(overrides) }, sdkVersionPin);
}

describe('validateProviderCapabilities', () => {
  it('agent jellegű node nélkül sikeres, a leírót el sem olvassa', () => {
    const plans = new Map<string, NodePlan>([['start', START_PLAN]]);

    expect(validateProviderCapabilities(plans, INSTALLED)).toStrictEqual({ kind: 'ok', value: undefined });
  });

  it('érvényes agent lépés esetén sikeres', () => {
    const plans = new Map<string, NodePlan>([
      ['start', START_PLAN],
      ['ag', agentPlan()],
    ]);

    expect(validateProviderCapabilities(plans, INSTALLED).kind).toBe('ok');
  });

  it('a leíró és a telepített SDK verzió eltérése provider_descriptor_sdk_mismatch, mindkét verzióval', () => {
    const plans = new Map<string, NodePlan>([['ag', agentPlan({}, '9.9.9-masik')]]);

    const outcome = validateProviderCapabilities(plans, INSTALLED);

    expect(outcome.kind === 'error' ? outcome.message : '').toContain('provider_descriptor_sdk_mismatch');
    expect(outcome.kind === 'error' ? outcome.message : '').toContain('9.9.9-masik');
    expect(outcome.kind === 'error' ? outcome.message : '').toContain(INSTALLED);
    expect(outcome.kind === 'error' ? outcome.message : '').toContain('ag');
  });

  it('ismeretlen modellazonosító esetén unknown_model_id, a futás indítása előtt', () => {
    const plans = new Map<string, NodePlan>([['ag', agentPlan({ modelId: 'nincs-ilyen-modell' })]]);

    const outcome = validateProviderCapabilities(plans, INSTALLED);

    expect(outcome.kind === 'error' ? outcome.message : '').toContain('unknown_model_id');
  });

  it('az ai_synthesis módú join settings alobjektuma ugyanígy ellenőrzött', () => {
    const joinPlan = planOf({
      type: 'join',
      mode: 'ai_synthesis',
      settings: agentStepConfig({ modelId: 'nincs-ilyen-modell' }),
      onUnhandledError: 'fail_run',
    });
    const plans = new Map<string, NodePlan>([['osszegzo', joinPlan]]);

    const outcome = validateProviderCapabilities(plans, INSTALLED);

    expect(outcome.kind === 'error' ? outcome.message : '').toContain('unknown_model_id');
    expect(outcome.kind === 'error' ? outcome.message : '').toContain('osszegzo');
  });

  it('a merge módú join nem agent lépés, tehát nem ellenőrzött', () => {
    const plans = new Map<string, NodePlan>([
      ['osszefuzo', planOf({ type: 'join', mode: 'merge', settings: {}, onUnhandledError: 'fail_run' }, '9.9.9-masik')],
    ]);

    expect(validateProviderCapabilities(plans, INSTALLED).kind).toBe('ok');
  });
});
