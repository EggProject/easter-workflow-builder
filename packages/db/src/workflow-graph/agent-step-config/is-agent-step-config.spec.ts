/* eslint-disable unicorn/no-null -- az `AgentStepConfig` nullázható mezői a tárolt JSON-ban `null` értéket hordoznak (SPEC-003 4.4); az `undefined` nem éli túl a JSON oszlopot, tehát a `null` itt adat, nem helyőrző */
import { describe, expect, it } from 'vitest';
import type { AgentStepConfig } from './agent-step-config.ts';
import { isAgentStepConfig } from './is-agent-step-config.ts';

// Minden nullázható mező üres: ez fedi a guard `null` ágait.
const minimalConfig: AgentStepConfig = {
  promptTemplate: '',
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

// Minden mező kitöltve: ez fedi a guard "van érték" ágait, mind a három
// tárolható MCP variánssal együtt.
const fullConfig: AgentStepConfig = {
  promptTemplate: 'Elemezd: {{input}}',
  providerId: 'minimax',
  modelId: 'MiniMax-M3',
  effort: 'high',
  thinking: 'adaptive',
  allowedTools: ['Bash'],
  disallowedTools: ['WebFetch'],
  permissionMode: 'default',
  maxTurns: 3,
  maxBudgetUsd: 1.5,
  systemPrompt: { type: 'preset', preset: 'claude_code', append: 'kiegészítés', excludeDynamicSections: true },
  agents: { reviewer: { description: 'ellenőr', prompt: 'nézd át' } },
  skills: ['code-review'],
  mcpServers: {
    local: { type: 'stdio', command: 'node', args: ['server.js'], envNames: ['MCP_TOKEN'] },
    remote: { type: 'sse', url: 'https://example.test/sse', authEnvName: 'MCP_AUTH' },
    web: { type: 'http', url: 'https://example.test/mcp', authEnvName: null },
  },
  enabledEngineHooks: ['emit_output_tool_stop'],
  cwd: '/workspace',
  additionalDirectories: ['/workspace/docs'],
  sandbox: {
    enabled: true,
    failIfUnavailable: false,
    autoAllowBashIfSandboxed: true,
    excludedCommands: ['git'],
    enableWeakerNestedSandbox: false,
  },
  agentTools: ['web_search'],
  sessionMode: 'continued',
  structuredOutput: { strategy: 'emit_output_tool', schema: { type: 'object' } },
};

/**
A teljes configból egyetlen mezőt cserél ki, a többit érintetlenül hagyja.
*/
function withField(field: string, value: unknown): unknown {
  return { ...fullConfig, [field]: value };
}

describe('isAgentStepConfig', () => {
  it('igazat ad az üres és a teljesen kitöltött configra is', () => {
    expect(isAgentStepConfig(minimalConfig)).toBe(true);
    expect(isAgentStepConfig(fullConfig)).toBe(true);
  });

  it('igazat ad a szöveges systemPrompt és az "all" skills alakra', () => {
    expect(isAgentStepConfig(withField('systemPrompt', 'Te egy elemző vagy.'))).toBe(true);
    expect(isAgentStepConfig(withField('skills', 'all'))).toBe(true);
  });

  it('igazat ad, ha a preset systemPrompt opcionális mezői üresek', () => {
    const prompt = { type: 'preset', preset: 'claude_code', append: null, excludeDynamicSections: null };
    expect(isAgentStepConfig(withField('systemPrompt', prompt))).toBe(true);
  });

  it('hamisat ad nem rekord bemenetre', () => {
    expect(isAgentStepConfig(null)).toBe(false);
    expect(isAgentStepConfig(undefined)).toBe(false);
    expect(isAgentStepConfig('agent_step')).toBe(false);
    expect(isAgentStepConfig([minimalConfig])).toBe(false);
  });

  // Mezőnként egy-egy rossz típusú érték: a guard minden operandusának a
  // hamis ágát is végig kell járni a 100 százalékos lefedettséghez.
  const rejectedFields: readonly (readonly [string, unknown])[] = [
    ['promptTemplate', 7],
    ['providerId', 'openai'],
    ['modelId', 7],
    ['effort', 7],
    ['thinking', 'turbo'],
    ['thinking', 7],
    ['allowedTools', 'Bash'],
    ['disallowedTools', [7]],
    ['permissionMode', 7],
    ['maxTurns', 'három'],
    ['maxBudgetUsd', 'sok'],
    ['systemPrompt', 7],
    ['agents', ['reviewer']],
    ['skills', 7],
    ['mcpServers', 'local'],
    ['enabledEngineHooks', 'emit_output_tool_stop'],
    ['enabledEngineHooks', ['unknown_hook']],
    ['enabledEngineHooks', [7]],
    ['cwd', 7],
    ['additionalDirectories', '/workspace'],
    ['sandbox', 7],
    ['agentTools', 'web_search'],
    ['agentTools', ['browse']],
    ['agentTools', [7]],
    ['sessionMode', 'resumed'],
    ['sessionMode', 7],
    ['structuredOutput', 7],
  ];

  for (const [field, value] of rejectedFields) {
    it(`hamisat ad, ha a ${field} mező értéke érvénytelen: ${JSON.stringify(value)}`, () => {
      expect(isAgentStepConfig(withField(field, value))).toBe(false);
    });
  }

  const rejectedSystemPrompts: readonly unknown[] = [
    { type: 'raw', preset: 'claude_code', append: null, excludeDynamicSections: null },
    { type: 'preset', preset: 'sonnet', append: null, excludeDynamicSections: null },
    { type: 'preset', preset: 'claude_code', append: 7, excludeDynamicSections: null },
    { type: 'preset', preset: 'claude_code', append: null, excludeDynamicSections: 'igen' },
  ];

  for (const [index, prompt] of rejectedSystemPrompts.entries()) {
    it(`hamisat ad hibás preset systemPrompt alakra (${String(index)})`, () => {
      expect(isAgentStepConfig(withField('systemPrompt', prompt))).toBe(false);
    });
  }

  const rejectedMcpServers: readonly unknown[] = [
    // az `sdk` variáns nem szerializálható, ezért nem tárolható
    { type: 'sdk', name: 'in-process' },
    'stdio',
    { command: 'node', args: [], envNames: [] },
    { type: 'stdio', command: 7, args: [], envNames: [] },
    { type: 'stdio', command: 'node', args: 'server.js', envNames: [] },
    { type: 'stdio', command: 'node', args: [], envNames: [7] },
    { type: 'sse', url: 7, authEnvName: null },
    { type: 'sse', url: 'https://example.test/sse', authEnvName: 7 },
    { type: 'http', url: 7, authEnvName: null },
  ];

  for (const [index, server] of rejectedMcpServers.entries()) {
    it(`hamisat ad nem tárolható MCP szerver alakra (${String(index)})`, () => {
      expect(isAgentStepConfig(withField('mcpServers', { one: server }))).toBe(false);
    });
  }

  it('elutasítja az env ÉRTÉKET hordozó MCP szerver alakot', () => {
    // A tárolt alak kizárólag env NEVET fogad el: az SDK `env` értékrekordja
    // nélkül a stdio variáns hiányos, tehát a guard elutasítja (SPEC-003 4.4,
    // 29. elfogadási kritérium).
    const withEnvironmentValues = { type: 'stdio', command: 'node', args: [], env: { MCP_TOKEN: 'titok' } };
    expect(isAgentStepConfig(withField('mcpServers', { one: withEnvironmentValues }))).toBe(false);
  });

  const rejectedSandboxes: readonly unknown[] = [
    {
      failIfUnavailable: false,
      autoAllowBashIfSandboxed: true,
      excludedCommands: [],
      enableWeakerNestedSandbox: false,
    },
    {
      enabled: true,
      failIfUnavailable: 'nem',
      autoAllowBashIfSandboxed: true,
      excludedCommands: [],
      enableWeakerNestedSandbox: false,
    },
    {
      enabled: true,
      failIfUnavailable: false,
      autoAllowBashIfSandboxed: 1,
      excludedCommands: [],
      enableWeakerNestedSandbox: false,
    },
    {
      enabled: true,
      failIfUnavailable: false,
      autoAllowBashIfSandboxed: true,
      excludedCommands: [],
      enableWeakerNestedSandbox: 'nem',
    },
    {
      enabled: true,
      failIfUnavailable: false,
      autoAllowBashIfSandboxed: true,
      excludedCommands: 'git',
      enableWeakerNestedSandbox: false,
    },
  ];

  for (const [index, sandbox] of rejectedSandboxes.entries()) {
    it(`hamisat ad hibás sandbox alakra (${String(index)})`, () => {
      expect(isAgentStepConfig(withField('sandbox', sandbox))).toBe(false);
    });
  }

  it('elfogadja a nyitott alakú sandbox mezőket, mert azokat nem szűkíti', () => {
    // A `network`, a `filesystem`, a `ripgrep`, az `ignoreViolations` és az
    // `allowUnsandboxedCommands` alakja nyitott kérdés, ezért a guard nem
    // vizsgálja (lásd `sandbox-config.ts`).
    const sandbox = {
      enabled: true,
      failIfUnavailable: false,
      autoAllowBashIfSandboxed: true,
      excludedCommands: ['git'],
      enableWeakerNestedSandbox: false,
      network: { allowedDomains: ['example.test'] },
      filesystem: { disabled: true },
      ripgrep: 'system',
      ignoreViolations: false,
      allowUnsandboxedCommands: ['git'],
    };
    expect(isAgentStepConfig(withField('sandbox', sandbox))).toBe(true);
  });

  const rejectedStructuredOutputs: readonly unknown[] = [
    { strategy: 7, schema: {} },
    { strategy: 'json_mode', schema: {} },
    { strategy: 'sdk_output_format' },
  ];

  for (const [index, structuredOutput] of rejectedStructuredOutputs.entries()) {
    it(`hamisat ad hibás strukturált kimenet alakra (${String(index)})`, () => {
      expect(isAgentStepConfig(withField('structuredOutput', structuredOutput))).toBe(false);
    });
  }

  it('elfogadja mindkét strukturált kimenet stratégiát, tetszőleges sémával', () => {
    expect(isAgentStepConfig(withField('structuredOutput', { strategy: 'sdk_output_format', schema: null }))).toBe(
      true,
    );
  });
});
