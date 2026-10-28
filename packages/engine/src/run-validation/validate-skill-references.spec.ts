/* eslint-disable unicorn/no-null -- az `AgentStepConfig` nullázható mezői (SPEC-003 4.3) a tárolt alakban valódi `null` értéket hordoznak */
import { describe, expect, it } from 'vitest';
import type { AgentStepConfig } from '@easter-workflow-builder/db';
import type { ExecutableNodeConfig } from './executable-node-config.ts';
import { validateSkillReferences } from './validate-skill-references.ts';

function agentStepConfig(skills: AgentStepConfig['skills'], agents: AgentStepConfig['agents'] = {}): AgentStepConfig {
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
    agents,
    skills,
    mcpServers: {},
    cwd: null,
    additionalDirectories: [],
    sandbox: null,
    sessionMode: 'isolated',
    structuredOutput: null,
  };
}

function agentNode(skills: AgentStepConfig['skills']): ExecutableNodeConfig {
  return { type: 'agent_step', onUnhandledError: 'fail_run', ...agentStepConfig(skills) };
}

function synthesisNode(skills: AgentStepConfig['skills']): ExecutableNodeConfig {
  return { type: 'join', mode: 'ai_synthesis', settings: agentStepConfig(skills), onUnhandledError: 'fail_run' };
}

function configsOf(
  entries: readonly (readonly [string, ExecutableNodeConfig])[],
): ReadonlyMap<string, ExecutableNodeConfig> {
  return new Map<string, ExecutableNodeConfig>(entries);
}

function withAgents(agents: AgentStepConfig['agents']): ExecutableNodeConfig {
  return { type: 'agent_step', onUnhandledError: 'fail_run', ...agentStepConfig(null, agents) };
}

const OK = { kind: 'ok', value: undefined };

describe('validateSkillReferences', () => {
  it('a könyvtárban álló skillekre hivatkozó lista zöld', () => {
    const configs = configsOf([['agent', agentNode(['alfa', 'beta'])]]);

    expect(validateSkillReferences(configs, ['alfa', 'beta'])).toStrictEqual(OK);
  });

  it('a null és az all állapot üres könyvtár mellett is zöld, mert nincs hiányzó eleme', () => {
    const configs = configsOf([
      ['nincs', agentNode(null)],
      ['minden', agentNode('all')],
    ]);

    expect(validateSkillReferences(configs, [])).toStrictEqual(OK);
  });

  it('a nem agent node-okat átugorja', () => {
    const configs = configsOf([
      ['start', { type: 'start', inputFields: [], onUnhandledError: 'fail_run' }],
      ['osszefuzes', { type: 'join', mode: 'merge', onUnhandledError: 'fail_run' }],
    ]);

    expect(validateSkillReferences(configs, [])).toStrictEqual(OK);
  });

  it('a hiányzó skillre skill_not_found hibát ad, a csomópont és a skill nevével', () => {
    const configs = configsOf([['agent', agentNode(['alfa', 'torolt'])]]);

    expect(validateSkillReferences(configs, ['alfa'])).toStrictEqual({
      kind: 'error',
      message:
        'A(z) agent csomópont a(z) "torolt" skillre hivatkozik, ami nincs a skill könyvtárban (skill_not_found).',
    });
  });

  it('a join ai_synthesis settings listáját is ellenőrzi', () => {
    const configs = configsOf([['szintezis', synthesisNode(['torolt'])]]);

    expect(validateSkillReferences(configs, [])).toStrictEqual({
      kind: 'error',
      message:
        'A(z) szintezis csomópont a(z) "torolt" skillre hivatkozik, ami nincs a skill könyvtárban (skill_not_found).',
    });
  });

  describe('az agent definíciók skills listája (SPEC-009 5.2, M-147)', () => {
    it('a könyvtárban álló, all és null állapotú definíciók zöldek', () => {
      const configs = configsOf([
        [
          'agent',
          withAgents({
            lista: { description: 'd', prompt: 'p', skills: ['alfa'] },
            minden: { description: 'd', prompt: 'p', skills: 'all' },
            nincs: { description: 'd', prompt: 'p', skills: null },
            hianyzo: { description: 'd', prompt: 'p' },
          }),
        ],
      ]);

      expect(validateSkillReferences(configs, ['alfa'])).toStrictEqual(OK);
    });

    it('a definíció hiányzó skilljére skill_not_found, a csomópont és az agent nevével', () => {
      const configs = configsOf([
        ['agent', withAgents({ segito: { description: 'd', prompt: 'p', skills: ['torolt'] } })],
      ]);

      expect(validateSkillReferences(configs, ['alfa'])).toStrictEqual({
        kind: 'error',
        message:
          'A(z) agent csomópont "segito" agent definíciója a(z) "torolt" skillre hivatkozik, ami nincs a skill könyvtárban (skill_not_found).',
      });
    });

    it('az érvénytelen alakú definíciót átugorja (azt a validateMcpServerReferences utasítja el)', () => {
      const configs = configsOf([['agent', withAgents({ segito: { description: 'd', prompt: 'p', skills: 7 } })]]);

      expect(validateSkillReferences(configs, [])).toStrictEqual(OK);
    });
  });
});
