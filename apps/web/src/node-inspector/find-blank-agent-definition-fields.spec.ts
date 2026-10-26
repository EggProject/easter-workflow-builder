/* eslint-disable unicorn/no-null -- a teszt fixture-ök a `node-config` séma nullázható mezőit hordozzák (SPEC-005). */
import { BLANK_FIELD_MESSAGE, type NodeConfig } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { AGENT_DEFINITION_FIELD_TABLE } from './agent-definition-field-table.ts';
import { findBlankAgentDefinitionFields } from './find-blank-agent-definition-fields.ts';

const AGENT_STEP_SETTINGS = {
  promptTemplate: 'sablon',
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
  sessionMode: 'isolated' as const,
  structuredOutput: null,
};

function agentStepWith(agents: Readonly<Record<string, unknown>>): NodeConfig {
  return { ...AGENT_STEP_SETTINGS, agents, type: 'agent_step', onUnhandledError: 'fail_run' };
}

function pathsOf(config: NodeConfig): readonly string[] {
  return findBlankAgentDefinitionFields(config).map((issue) => issue.path.join('.'));
}

describe('findBlankAgentDefinitionFields (SPEC-008 5.4, O-38)', () => {
  it('a kötelező mezők a tábla required sorai: description és prompt', () => {
    expect(AGENT_DEFINITION_FIELD_TABLE.filter((field) => field.required).map((field) => field.key)).toEqual([
      'description',
      'prompt',
    ]);
  });

  it('kitöltött description és prompt mellett nincs hiba', () => {
    expect(pathsOf(agentStepWith({ kutato: { description: 'Kutató', prompt: 'Keress forrást.' } }))).toEqual([]);
  });

  for (const [description, value] of [
    ['üres', ''],
    ['csak szóközös', ' \t\n '],
    ['hiányzó', undefined],
    ['nem szöveg', 5],
  ] as const) {
    it(`a(z) ${description} description és prompt a mező útvonalán, a mentési séma üres mező mondatával jelez`, () => {
      const issues = findBlankAgentDefinitionFields(agentStepWith({ kutato: { description: value, prompt: value } }));

      expect(issues).toEqual([
        { path: ['agents', 'kutato', 'description'], message: BLANK_FIELD_MESSAGE },
        { path: ['agents', 'kutato', 'prompt'], message: BLANK_FIELD_MESSAGE },
      ]);
    });
  }

  it('az "Agent hozzáadása" által felvett üres bejegyzés mindkét kötelező mezője jelez', () => {
    expect(pathsOf(agentStepWith({ uj: { description: '', prompt: '' } }))).toEqual([
      'agents.uj.description',
      'agents.uj.prompt',
    ]);
  });

  it('bejegyzésenként külön hibát ad, a bejegyzés nevével', () => {
    expect(
      pathsOf(
        agentStepWith({
          elso: { description: 'Első', prompt: '' },
          masodik: { description: ' ', prompt: 'Második' },
        }),
      ),
    ).toEqual(['agents.elso.prompt', 'agents.masodik.description']);
  });

  it('a nem objektum alakú bejegyzésnek nincs szerkeszthető mezője, tehát hibája sincs', () => {
    expect(pathsOf(agentStepWith({ szoveg: 'nem objektum', lista: ['x'] }))).toEqual([]);
  });

  it('a join ai_synthesis módjában a settings.agents útvonalon jelez', () => {
    const config: NodeConfig = {
      type: 'join',
      mode: 'ai_synthesis',
      settings: { ...AGENT_STEP_SETTINGS, agents: { osszegzo: { description: 'Összegző', prompt: '' } } },
      onUnhandledError: 'fail_run',
    };

    expect(pathsOf(config)).toEqual(['settings.agents.osszegzo.prompt']);
  });

  it('agents mező nélküli típusnál és join módnál nincs hiba', () => {
    expect(pathsOf({ type: 'join', mode: 'merge', settings: {}, onUnhandledError: 'fail_run' })).toEqual([]);
    expect(pathsOf({ type: 'join', mode: null, onUnhandledError: 'fail_run' })).toEqual([]);
    expect(pathsOf({ type: 'script', source: 'x', runtime: 'expression', onUnhandledError: 'fail_run' })).toEqual([]);
  });
});
