/* eslint-disable unicorn/no-null -- az AgentStepConfig nullázható mezői a dróton ténylegesen `null` értéket hordozzák, nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import { WorkflowGraphDocumentSchema } from '../workflow/workflow-graph-document.ts';
import { AgentStepConfigSchema, PresetSystemPromptSchema, StructuredOutputConfigSchema } from './agent-step-config.ts';
import { NodeConfigSaveSchema } from './node-config-save-schema.ts';
import { NodeConfigSchema } from './node-config.ts';

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
  cwd: null,
  additionalDirectories: [],
  sandbox: null,
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
      structuredOutput: { strategy: 'sdk_output_format', schema: { type: 'object' } },
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

/**
 * A lépés hivatkozás mezője (SPEC-009 6.2, O-42 (b)) és a régi alak
 * olvashatósága (AC20, `docs/research/2026-10-26-spec-009-forrasok.md` 9.5
 * szekció 3. pont): a mező nélküli, nem üres régi `mcpServers` értékű config
 * az olvasó, a mentési és a gráf dokumentum sémán is átmegy.
 */
describe('AgentStepConfigSchema: mcpServerReferences (O-42)', () => {
  const LEGACY_AGENT_STEP_NODE_CONFIG = {
    ...VALID_AGENT_STEP_CONFIG,
    mcpServers: {
      local: { type: 'stdio', command: 'node', args: ['server.js'], envNames: ['MCP_TOKEN'] },
      remote: { type: 'sse', url: 'https://example.test/sse', authEnvName: 'MCP_AUTH' },
      web: { type: 'http', url: 'https://example.test/mcp', authEnvName: null },
    },
    type: 'agent_step',
    onUnhandledError: 'fail_run',
  };

  it('a hivatkozás mezővel és az üres rekorddal is elfogadja', () => {
    const references = { github_ceg: { envBindings: { GITHUB_TOKEN: 'GITHUB_TOKEN_CEG' }, authEnvName: null } };
    const parsed = AgentStepConfigSchema.safeParse({ ...VALID_AGENT_STEP_CONFIG, mcpServerReferences: references });
    expect(parsed.success ? parsed.data.mcpServerReferences : undefined).toStrictEqual(references);
    expect(AgentStepConfigSchema.safeParse({ ...VALID_AGENT_STEP_CONFIG, mcpServerReferences: {} }).success).toBe(true);
  });

  it('a mező hiánya nem hiba, és a kimenetben sem jelenik meg', () => {
    const parsed = AgentStepConfigSchema.safeParse(VALID_AGENT_STEP_CONFIG);
    expect(parsed.success && Object.hasOwn(parsed.data, 'mcpServerReferences')).toBe(false);
  });

  it.each([
    ['undefined érték', undefined],
    ['nem rekord', []],
    ['ismeretlen kulcsú bejegyzés', { s: { envBindings: {}, authEnvName: null, env: { A: 'titok' } } }],
  ])('elutasítja: %s', (_label, value) => {
    expect(AgentStepConfigSchema.safeParse({ ...VALID_AGENT_STEP_CONFIG, mcpServerReferences: value }).success).toBe(
      false,
    );
  });

  it('a mező nélküli régi alak az olvasó, a mentési és a gráf dokumentum sémán is átmegy (AC20)', () => {
    expect(NodeConfigSchema.safeParse(LEGACY_AGENT_STEP_NODE_CONFIG).success).toBe(true);
    expect(NodeConfigSaveSchema.safeParse(LEGACY_AGENT_STEP_NODE_CONFIG).success).toBe(true);
    const document = {
      nodes: [
        {
          id: 'regi',
          type: 'agent_step',
          label: 'Régi',
          positionX: 0,
          positionY: 0,
          config: LEGACY_AGENT_STEP_NODE_CONFIG,
          createdAtMs: 0,
          updatedAtMs: 0,
        },
      ],
      edges: [],
    };
    const parsed = WorkflowGraphDocumentSchema.safeParse(document);
    expect(parsed.success ? parsed.data : undefined).toStrictEqual(document);
  });
});
