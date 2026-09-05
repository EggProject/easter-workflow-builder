/* eslint-disable unicorn/no-null -- az AgentStepConfig nullázható mezői a dróton ténylegesen `null` értéket hordozzák, nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import { AgentStepConfigSchema, PresetSystemPromptSchema, StructuredOutputConfigSchema } from './agent-step-config.ts';

const VALID_AGENT_STEP_CONFIG = {
  promptTemplate: 'Foglald össze: {{input}}',
  providerId: null,
  modelId: null,
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

describe('AgentStepConfigSchema', () => {
  it('elfogadja a teljes, csak null/üres mezőkkel kitöltött alakot', () => {
    expect(AgentStepConfigSchema.safeParse(VALID_AGENT_STEP_CONFIG).success).toBe(true);
  });

  it('elfogadja a kitöltött, nem null mezőket hordozó alakot', () => {
    const result = AgentStepConfigSchema.safeParse({
      ...VALID_AGENT_STEP_CONFIG,
      providerId: 'claude-subscription',
      modelId: 'claude-sonnet-5',
      effort: 'high',
      thinking: 'adaptive',
      allowedTools: ['Read'],
      disallowedTools: ['Bash'],
      permissionMode: 'default',
      maxTurns: 10,
      maxBudgetUsd: 5,
      systemPrompt: 'Légy tömör.',
      skills: 'all',
      cwd: '/workspace',
      additionalDirectories: ['/data'],
      agentTools: ['web_search'],
      structuredOutput: { strategy: 'emit_output_tool', schema: { type: 'object' } },
    });
    expect(result.success).toBe(true);
  });

  it('az agents mező tetszőleges kulcsú, tetszőleges alakú értéket fogad (nem szűkített Record<string, unknown>)', () => {
    const result = AgentStepConfigSchema.safeParse({
      ...VALID_AGENT_STEP_CONFIG,
      agents: { reviewer: { unknownField: 'bármi', criticalSystemReminder_EXPERIMENTAL: 'x' } },
    });
    expect(result.success).toBe(true);
  });

  it('érvénytelen providerId-t elutasít', () => {
    expect(
      AgentStepConfigSchema.safeParse({ ...VALID_AGENT_STEP_CONFIG, providerId: 'unknown-provider' }).success,
    ).toBe(false);
  });

  it('hiányzó kötelező mezőre elutasít', () => {
    const { promptTemplate, ...withoutPromptTemplate } = VALID_AGENT_STEP_CONFIG;
    expect(promptTemplate).toBeTruthy();
    expect(AgentStepConfigSchema.safeParse(withoutPromptTemplate).success).toBe(false);
  });

  it('ismeretlen kulcsot elutasít (strictObject)', () => {
    expect(AgentStepConfigSchema.safeParse({ ...VALID_AGENT_STEP_CONFIG, extra: 1 }).success).toBe(false);
  });

  it('a preset systemPrompt alakot is elfogadja', () => {
    const preset = { type: 'preset', preset: 'claude_code', append: null, excludeDynamicSections: null };
    expect(PresetSystemPromptSchema.safeParse(preset).success).toBe(true);
    expect(AgentStepConfigSchema.safeParse({ ...VALID_AGENT_STEP_CONFIG, systemPrompt: preset }).success).toBe(true);
  });

  it('a structuredOutput schema mezője tetszőleges alakot fogad (unknown)', () => {
    expect(StructuredOutputConfigSchema.safeParse({ strategy: 'sdk_output_format', schema: ['bármi'] }).success).toBe(
      true,
    );
  });
});
