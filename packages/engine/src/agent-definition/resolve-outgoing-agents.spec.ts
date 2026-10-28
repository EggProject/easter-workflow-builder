/* eslint-disable unicorn/no-null -- a `skills` és az `authEnvName` tárolt alakja `null`-lal jelzi a hiányt (SPEC-003 4.4, SPEC-009 6.2) */
import { describe, expect, it } from 'vitest';
import type { McpServerDefinitionRecord } from '@easter-workflow-builder/db';
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

function environmentOf(values: Readonly<Record<string, string>>): ProcessEnvironmentPort {
  const entries = new Map(Object.entries(values));
  return { read: (name) => entries.get(name) ?? null, readAll: () => values };
}

describe('resolveOutgoingAgents', () => {
  it('üres agents rekordra üres kimenet, skill igény nélkül', () => {
    expect(resolveOutgoingAgents('a1', {}, LIBRARY, [], environmentOf({}))).toStrictEqual({
      kind: 'ok',
      value: { definitions: {}, hasSkillReferences: false },
    });
  });

  it('a skills listát minősíti, az all-t a könyvtár neveire fordítja, a null-t és a hiányzót elhagyja', () => {
    const resolved = resolveOutgoingAgents(
      'a1',
      {
        lista: { description: 'd', prompt: 'p', skills: ['beta'] },
        minden: { description: 'd', prompt: 'p', skills: 'all' },
        nincs: { description: 'd', prompt: 'p', skills: null },
        hianyzo: { description: 'd', prompt: 'p', model: 'sonnet' },
      },
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
        hasSkillReferences: true,
      },
    });
  });

  it('csak null skills mellett nincs skill igény', () => {
    const resolved = resolveOutgoingAgents(
      'a1',
      { nincs: { description: 'd', prompt: 'p', skills: null } },
      LIBRARY,
      [],
      environmentOf({}),
    );

    expect(resolved.kind === 'ok' && resolved.value.hasSkillReferences).toBe(false);
  });

  it('az MCP hivatkozást szerverenként egy objektum elemre oldja fel, a régi lista elemei elöl maradnak, a hivatkozás mező nem megy ki', () => {
    const resolved = resolveOutgoingAgents(
      'a1',
      {
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
      },
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
        hasSkillReferences: false,
      },
    });
  });

  it('az érvénytelen alakú definícióra malformed_node_config, a csomópont és az agent nevével', () => {
    expect(resolveOutgoingAgents('a1', { segito: { skills: 7 } }, LIBRARY, [], environmentOf({}))).toStrictEqual({
      kind: 'error',
      errorKind: 'malformed_node_config',
      message: 'A(z) a1 csomópont "segito" agent definíciója érvénytelen alakú (malformed_node_config).',
    });
  });

  it('a nem név alakú szerver oldali név malformed_node_config, és az érték nem jelenik meg az üzenetben (T-012-27)', () => {
    const outcome = resolveOutgoingAgents(
      'a1',
      {
        segito: { mcpServerReferences: { github: { envBindings: { GITHUB_TOKEN: 'ghp-titok' }, authEnvName: null } } },
      },
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
        { segito: { mcpServerReferences: { github: NO_OVERRIDE } } },
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
});
