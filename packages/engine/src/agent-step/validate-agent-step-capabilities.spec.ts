/* eslint-disable unicorn/no-null -- az `AgentStepConfig` nullázható mezői (`modelId`, `thinking`, `effort`, `structuredOutput`, ...) és a `Fact<string | null>` értékek a tárolt, illetve mért alakban `null` értéket hordoznak (SPEC-003 4.4, SPEC-000 5.), nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import type { AgentStepConfig } from '@easter-workflow-builder/db';
import type {
  Fact,
  ModelDescriptor,
  ServerToolDescriptor,
  StructuredOutputStrategy,
  ThinkingMode,
} from '@easter-workflow-builder/provider-capability';
import type { AgentStepDescriptorFields } from './validate-agent-step-capabilities.ts';
import { validateAgentStepCapabilities } from './validate-agent-step-capabilities.ts';

function knownFact<TValue>(value: TValue): Fact<TValue> {
  return { state: 'known', value, evidence: [{ kind: 'measurement', id: 'M-01' }] };
}

function unknownFact<TValue>(): Fact<TValue> {
  return { state: 'unknown', reason: 'A mérés még nem futott le.', blockedBy: ['M-99'] };
}

function agentStepConfig(overrides: Partial<AgentStepConfig> = {}): AgentStepConfig {
  return {
    promptTemplate: 'prompt',
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

function model(id: string, clientModelIdentifier: Fact<string>): ModelDescriptor<string, string> {
  return {
    id,
    family: 'csalad-1',
    clientModelIdentifier,
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

function strategy(overrides: Partial<StructuredOutputStrategy> = {}): StructuredOutputStrategy {
  return {
    id: 'emit_output_tool',
    usable: knownFact(true),
    blockingWireDetail: knownFact<string | null>(null),
    observedRoundTrips: knownFact<readonly number[]>([3]),
    ...overrides,
  };
}

function serverTool(overrides: Partial<ServerToolDescriptor> = {}): ServerToolDescriptor {
  return {
    wireType: 'kereses_20250101',
    name: 'kereses',
    available: knownFact(false),
    clientToolName: knownFact<string | null>('KliensKereses'),
    ...overrides,
  };
}

function descriptor(overrides: Partial<AgentStepDescriptorFields> = {}): AgentStepDescriptorFields {
  return {
    models: [model('modell-1', knownFact('modell-1-kliens'))],
    thinking: {
      byModelFamily: { 'csalad-1': knownFact<readonly ThinkingMode[]>(['adaptive', 'disabled']) },
      wireShape: knownFact('{"type":"adaptive"}'),
      sendsBudgetTokens: knownFact(false),
      interleavedSignatureRequired: knownFact(false),
      streamEventTypes: knownFact<readonly string[]>([]),
    },
    effort: { accepted: knownFact(true), wireField: knownFact<string | null>(null) },
    toolChoice: {
      accepted: knownFact<readonly ('auto' | 'none' | 'any' | 'tool')[]>(['auto', 'none']),
      rejectionBehaviour: knownFact('silently_dropped'),
      sdkSendsForcedChoice: knownFact(false),
    },
    structuredOutput: {
      strategies: [strategy()],
      defaultStrategy: knownFact('emit_output_tool'),
      outputConfigAlwaysSent: knownFact(false),
      outputConfigWireField: knownFact<string | null>(null),
    },
    serverTools: knownFact<readonly ServerToolDescriptor[]>([serverTool()]),
    streaming: {
      sse: knownFact(true),
      toolInputDelta: knownFact('input_json_delta'),
      sdkReassemblesToolInput: knownFact(true),
      fineGrainedToolStreaming: knownFact(false),
      streamDisableable: knownFact(false),
    },
    ...overrides,
  };
}

describe('validateAgentStepCapabilities', () => {
  it('a hat döntést egyetlen menetben adja ki', () => {
    const config = agentStepConfig({
      thinking: 'adaptive',
      effort: 'high',
      structuredOutput: { strategy: 'emit_output_tool', schema: {} },
    });

    const outcome = validateAgentStepCapabilities(config, descriptor());

    expect(outcome).toStrictEqual({
      status: 'ok',
      decisions: {
        model: { outgoingModel: 'modell-1-kliens', modelIdentifierUnproven: false },
        structuredOutput: { strategy: strategy(), strategyUnproven: false },
        thinking: 'adaptive',
        effort: 'high',
        disallowedServerTools: { disallowedTools: ['KliensKereses'], serverToolAvailabilityUnproven: false },
        includePartialMessages: true,
      },
    });
  });

  it('modellválasztás nélkül, több modellnél model_not_selected', () => {
    const models = [model('modell-1', knownFact('a')), model('modell-2', knownFact('b'))];

    const outcome = validateAgentStepCapabilities(agentStepConfig({ modelId: null }), descriptor({ models }));

    expect(outcome.status).toBe('failed');
    expect(outcome.status === 'failed' ? outcome.errorKind : '').toBe('model_not_selected');
  });

  it('a leíróban nem szereplő modellazonosító unknown_model_id hibát ad', () => {
    const outcome = validateAgentStepCapabilities(agentStepConfig({ modelId: 'ismeretlen' }), descriptor());

    expect(outcome.status === 'failed' ? outcome.errorKind : '').toBe('unknown_model_id');
  });

  it('nem engedett thinking mód thinking_mode_unsupported hibát ad', () => {
    const outcome = validateAgentStepCapabilities(agentStepConfig({ thinking: 'always_on' }), descriptor());

    expect(outcome.status === 'failed' ? outcome.errorKind : '').toBe('thinking_mode_unsupported');
  });

  it('unknown thinking leírónál a mező elmarad, hiba nélkül', () => {
    const outcome = validateAgentStepCapabilities(
      agentStepConfig({ thinking: 'adaptive' }),
      descriptor({
        thinking: {
          byModelFamily: { 'csalad-1': unknownFact<readonly ThinkingMode[]>() },
          wireShape: unknownFact<string>(),
          sendsBudgetTokens: unknownFact<boolean>(),
          interleavedSignatureRequired: unknownFact<boolean>(),
          streamEventTypes: unknownFact<readonly string[]>(),
        },
      }),
    );

    expect(outcome.status === 'ok' ? outcome.decisions.thinking : 'nem ok').toBeUndefined();
  });

  it('el nem fogadott effort mellett effort_unsupported hibát ad', () => {
    const effort = { accepted: knownFact(false), wireField: knownFact<string | null>(null) };

    const outcome = validateAgentStepCapabilities(agentStepConfig({ effort: 'high' }), descriptor({ effort }));

    expect(outcome.status === 'failed' ? outcome.errorKind : '').toBe('effort_unsupported');
  });

  it('csendben eldobott kényszerített tool_choice forced_tool_choice_silently_dropped hibát ad', () => {
    const outcome = validateAgentStepCapabilities(
      agentStepConfig(),
      descriptor({
        toolChoice: {
          accepted: knownFact<readonly ('auto' | 'none' | 'any' | 'tool')[]>(['auto', 'none']),
          rejectionBehaviour: knownFact('silently_dropped'),
          sdkSendsForcedChoice: knownFact(true),
        },
      }),
    );

    expect(outcome.status === 'failed' ? outcome.errorKind : '').toBe('forced_tool_choice_silently_dropped');
  });

  it('nem használható stratégia structured_output_strategy_unsupported hibát ad', () => {
    const strategies = [strategy({ usable: knownFact(false) })];
    const structuredOutput = {
      strategies,
      defaultStrategy: knownFact<'emit_output_tool' | 'sdk_output_format'>('emit_output_tool'),
      outputConfigAlwaysSent: knownFact(false),
      outputConfigWireField: knownFact<string | null>(null),
    };
    const config = agentStepConfig({ structuredOutput: { strategy: 'emit_output_tool', schema: {} } });

    const outcome = validateAgentStepCapabilities(config, descriptor({ structuredOutput }));

    expect(outcome.status === 'failed' ? outcome.errorKind : '').toBe('structured_output_strategy_unsupported');
  });

  it('a megfigyelt körszám alatti maxTurns insufficient_max_turns hibát ad', () => {
    const outcome = validateAgentStepCapabilities(
      agentStepConfig({ maxTurns: 1, structuredOutput: { strategy: 'emit_output_tool', schema: {} } }),
      descriptor(),
    );

    expect(outcome.status === 'failed' ? outcome.errorKind : '').toBe('insufficient_max_turns');
  });

  it('unknown clientModelIdentifier mellett a wire azonosító megy ki, jelöléssel', () => {
    const models = [model('modell-1', unknownFact<string>())];

    const outcome = validateAgentStepCapabilities(agentStepConfig(), descriptor({ models }));

    expect(outcome.status === 'ok' ? outcome.decisions.model : undefined).toStrictEqual({
      outgoingModel: 'modell-1',
      modelIdentifierUnproven: true,
    });
  });

  it('unknown serverTools mellett nem tiltunk, de jelölünk', () => {
    const serverTools = unknownFact<readonly ServerToolDescriptor[]>();

    const outcome = validateAgentStepCapabilities(agentStepConfig(), descriptor({ serverTools }));

    expect(outcome.status === 'ok' ? outcome.decisions.disallowedServerTools : undefined).toStrictEqual({
      disallowedTools: [],
      serverToolAvailabilityUnproven: true,
    });
  });

  it('unknown streaming.sse mellett nem kérünk részleges üzeneteket', () => {
    const outcome = validateAgentStepCapabilities(
      agentStepConfig(),
      descriptor({
        streaming: {
          sse: unknownFact<boolean>(),
          toolInputDelta: unknownFact<'input_json_delta' | 'whole_input_in_content_block_start' | 'other'>(),
          sdkReassemblesToolInput: unknownFact<boolean>(),
          fineGrainedToolStreaming: unknownFact<boolean>(),
          streamDisableable: unknownFact<boolean>(),
        },
      }),
    );

    expect(outcome.status === 'ok' ? outcome.decisions.includePartialMessages : true).toBe(false);
  });

  it('strukturált kimenetet nem váró lépésnél nincs stratégia döntés', () => {
    const outcome = validateAgentStepCapabilities(agentStepConfig(), descriptor());

    expect(outcome.status === 'ok' ? outcome.decisions.structuredOutput : 'nem ok').toBeUndefined();
  });
});
