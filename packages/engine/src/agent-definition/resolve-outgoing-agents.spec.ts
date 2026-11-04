/* eslint-disable unicorn/no-null -- a `skills` és az `authEnvName` tárolt alakja `null`-lal jelzi a hiányt (SPEC-003 4.4, SPEC-009 6.2) */
import { describe, expect, it } from 'vitest';
import type { AgentStepConfig, McpServerDefinitionRecord } from '@easter-workflow-builder/db';
import type { ProcessEnvironmentPort } from '../engine-port/process-environment-port.ts';
import type { SkillLibrarySnapshot } from '../engine-port/skill-library-snapshot.ts';
import { resolveOutgoingAgents } from './resolve-outgoing-agents.ts';

const LIBRARY: SkillLibrarySnapshot = {
  rootDirectory: '/var/skillek',
  pluginName: 'skillek',
  skillNames: ['alfa', 'beta'],
};

const GITHUB: McpServerDefinitionRecord = {
  name: 'github',
  definition: { type: 'stdio', command: 'github-mcp', args: [], envNames: ['GITHUB_TOKEN'], envBindings: {} },
};

const NO_OVERRIDE = { envBindings: {}, authEnvName: null };

/**
 * A lépés configja a megadott agent rekorddal; a lépés alapból minden feltöltött skillt kiválaszt.
 */
function step(agents: AgentStepConfig['agents'], overrides: Partial<AgentStepConfig> = {}): AgentStepConfig {
  return {
    promptTemplate: 'prompt',
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
    agents,
    skills: 'all',
    mcpServers: {},
    cwd: null,
    additionalDirectories: [],
    sandbox: null,
    sessionMode: 'isolated',
    structuredOutput: null,
    ...overrides,
  };
}

function environmentOf(values: Readonly<Record<string, string>>): ProcessEnvironmentPort {
  const entries = new Map(Object.entries(values));
  return { read: (name) => entries.get(name) ?? null, readAll: () => values };
}

describe('resolveOutgoingAgents', () => {
  it('üres agents rekordra üres kimenet', () => {
    expect(resolveOutgoingAgents('a1', step({}), LIBRARY, [], environmentOf({}))).toStrictEqual({
      kind: 'ok',
      value: { definitions: {} },
    });
  });

  it('a skills listát minősíti, az all-t a könyvtár neveire fordítja, a null-t és a hiányzót elhagyja', () => {
    const resolved = resolveOutgoingAgents(
      'a1',
      step({
        lista: { description: 'd', prompt: 'p', skills: ['beta'] },
        minden: { description: 'd', prompt: 'p', skills: 'all' },
        nincs: { description: 'd', prompt: 'p', skills: null },
        hianyzo: { description: 'd', prompt: 'p', model: 'sonnet' },
      }),
      LIBRARY,
      [],
      environmentOf({}),
    );

    expect(resolved).toStrictEqual({
      kind: 'ok',
      value: {
        definitions: {
          lista: { description: 'd', prompt: 'p', skills: ['skillek:beta'] },
          minden: { description: 'd', prompt: 'p', skills: ['skillek:alfa', 'skillek:beta'] },
          nincs: { description: 'd', prompt: 'p' },
          hianyzo: { description: 'd', prompt: 'p', model: 'sonnet' },
        },
      },
    });
  });

  it('az MCP hivatkozást szerverenként egy objektum elemre oldja fel, a régi lista elemei elöl maradnak, a hivatkozás mező nem megy ki', () => {
    const resolved = resolveOutgoingAgents(
      'a1',
      step({
        uj: {
          description: 'd',
          prompt: 'p',
          mcpServerReferences: { github: { envBindings: { GITHUB_TOKEN: 'TOKEN_SAJAT' }, authEnvName: null } },
        },
        vegyes: {
          description: 'd',
          prompt: 'p',
          mcpServers: ['lepes-szerver'],
          mcpServerReferences: { github: NO_OVERRIDE },
        },
        regi: { description: 'd', prompt: 'p', mcpServers: ['lepes-szerver'] },
      }),
      LIBRARY,
      [GITHUB],
      environmentOf({ TOKEN_SAJAT: 'sajat-ertek', GITHUB_TOKEN: 'alap-ertek' }),
    );

    expect(resolved).toStrictEqual({
      kind: 'ok',
      value: {
        definitions: {
          uj: {
            description: 'd',
            prompt: 'p',
            mcpServers: [
              { github: { type: 'stdio', command: 'github-mcp', args: [], env: { GITHUB_TOKEN: 'sajat-ertek' } } },
            ],
          },
          vegyes: {
            description: 'd',
            prompt: 'p',
            mcpServers: [
              'lepes-szerver',
              { github: { type: 'stdio', command: 'github-mcp', args: [], env: { GITHUB_TOKEN: 'alap-ertek' } } },
            ],
          },
          regi: { description: 'd', prompt: 'p', mcpServers: ['lepes-szerver'] },
        },
      },
    });
  });

  it('a régi lista közvetlen szerver objektuma és a memory mező nem megy ki, a név elem igen (O-53)', () => {
    const resolved = resolveOutgoingAgents(
      'a1',
      step({
        regi: {
          description: 'd',
          prompt: 'p',
          memory: 'user',
          mcpServers: ['lepes-szerver', { inline: { command: 'kerulo', env: { TITOK: 'literal' } } }],
        },
        csakObjektum: { description: 'd', prompt: 'p', mcpServers: [{ inline: { command: 'kerulo' } }] },
      }),
      LIBRARY,
      [],
      environmentOf({}),
    );

    expect(resolved).toStrictEqual({
      kind: 'ok',
      value: {
        definitions: {
          regi: { description: 'd', prompt: 'p', mcpServers: ['lepes-szerver'] },
          csakObjektum: { description: 'd', prompt: 'p' },
        },
      },
    });
  });

  it('az érvénytelen alakú definícióra malformed_node_config, a csomópont és az agent nevével', () => {
    expect(resolveOutgoingAgents('a1', step({ segito: { skills: 7 } }), LIBRARY, [], environmentOf({}))).toStrictEqual({
      kind: 'error',
      errorKind: 'malformed_node_config',
      message: 'A(z) a1 csomópont "segito" agent definíciója érvénytelen alakú (malformed_node_config).',
    });
  });

  it('a nem név alakú szerver oldali név malformed_node_config, és az érték nem jelenik meg az üzenetben (T-012-27)', () => {
    const outcome = resolveOutgoingAgents(
      'a1',
      step({
        segito: { mcpServerReferences: { github: { envBindings: { GITHUB_TOKEN: 'ghp-titok' }, authEnvName: null } } },
      }),
      LIBRARY,
      [],
      environmentOf({}),
    );

    expect(outcome).toStrictEqual({
      kind: 'error',
      errorKind: 'malformed_node_config',
      message: 'A(z) a1 csomópont "segito" agent definíciója érvénytelen alakú (malformed_node_config).',
    });
  });

  it('a feloldás hibáját az agent definíció alanyával adja tovább', () => {
    expect(
      resolveOutgoingAgents(
        'a1',
        step({ segito: { mcpServerReferences: { github: NO_OVERRIDE } } }),
        LIBRARY,
        [GITHUB],
        environmentOf({}),
      ),
    ).toStrictEqual({
      kind: 'error',
      errorKind: 'missing_mcp_server_env',
      message:
        'A(z) a1 csomópont "segito" agent definíciója "github" MCP szerverének "GITHUB_TOKEN" változójához rendelt "GITHUB_TOKEN" szerver oldali env változó nincs beállítva (missing_mcp_server_env).',
    });
  });

  describe('a lépés kiválasztott skilljei mérvadók (SPEC-009 O-47, M-150)', () => {
    const AGENT_ALFA = { segito: { description: 'd', prompt: 'p', skills: ['alfa'] } };
    const notInStep = {
      kind: 'error',
      errorKind: 'agent_skill_not_in_step',
      message:
        'A(z) a1 csomópont "segito" agent definíciója a(z) "alfa" skillre hivatkozik, ami nincs a lépés kiválasztott skilljei között (agent_skill_not_in_step).',
    };

    it('a lépés listáján álló skill kimegy', () => {
      const resolved = resolveOutgoingAgents(
        'a1',
        step(AGENT_ALFA, { skills: ['alfa'] }),
        LIBRARY,
        [],
        environmentOf({}),
      );
      expect(resolved.kind).toBe('ok');
    });

    it('a lépés listáján kívüli skill agent_skill_not_in_step', () => {
      expect(
        resolveOutgoingAgents('a1', step(AGENT_ALFA, { skills: ['beta'] }), LIBRARY, [], environmentOf({})),
      ).toStrictEqual(notInStep);
    });

    it('a null lépésen bármely agent skill agent_skill_not_in_step (a feltöltött skillek nem mennek ki)', () => {
      expect(
        resolveOutgoingAgents('a1', step(AGENT_ALFA, { skills: null }), LIBRARY, [], environmentOf({})),
      ).toStrictEqual(notInStep);
    });

    it('az agent all módja a könyvtár minden nevét kéri: a szűkebb lépés listán az első hiányzó a hiba', () => {
      const agents = { segito: { description: 'd', prompt: 'p', skills: 'all' } };
      const resolved = resolveOutgoingAgents('a1', step(agents, { skills: ['beta'] }), LIBRARY, [], environmentOf({}));
      expect(resolved).toStrictEqual(notInStep);
    });

    it('a null lépésen a null és az üres listájú agent definíció elfogadott', () => {
      const agents = {
        nincs: { description: 'd', prompt: 'p', skills: null },
        ures: { description: 'd', prompt: 'p', skills: [] },
      };
      const resolved = resolveOutgoingAgents('a1', step(agents, { skills: null }), LIBRARY, [], environmentOf({}));
      expect(resolved.kind).toBe('ok');
    });
  });

  describe('a lépés szerverével azonos nevű agent MCP felülírás (SPEC-009 O-48)', () => {
    const agents = { segito: { description: 'd', prompt: 'p', mcpServerReferences: { github: NO_OVERRIDE } } };

    it('agent_mcp_server_override_conflict, a szerver nevével', () => {
      expect(
        resolveOutgoingAgents(
          'a1',
          step(agents, { mcpServerReferences: { github: NO_OVERRIDE } }),
          LIBRARY,
          [GITHUB],
          environmentOf({ GITHUB_TOKEN: 'ertek' }),
        ),
      ).toStrictEqual({
        kind: 'error',
        errorKind: 'agent_mcp_server_override_conflict',
        message:
          'A(z) a1 csomópont "segito" agent definíciója a(z) "github" MCP szervert felülírja, de a lépés is ezt a szervert hivatkozza (agent_mcp_server_override_conflict).',
      });
    });

    it('a lépés más nevű szervere mellett a felülírás kimegy, és a régi lista szöveg eleme nem ütközés', () => {
      const withLegacy = { segito: { ...agents.segito, mcpServers: ['docs'] } };
      const resolved = resolveOutgoingAgents(
        'a1',
        step(withLegacy, { mcpServerReferences: { docs: NO_OVERRIDE } }),
        LIBRARY,
        [GITHUB],
        environmentOf({ GITHUB_TOKEN: 'ertek' }),
      );
      expect(resolved.kind).toBe('ok');
    });
  });
});
