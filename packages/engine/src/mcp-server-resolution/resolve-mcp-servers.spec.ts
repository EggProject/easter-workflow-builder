/* eslint-disable unicorn/no-null -- a `McpServerReference.authEnvName` és a definíció `authEnvName` mezője valódi `null` értéket hordoz (SPEC-009 6.1, 6.2) */
import { describe, expect, it } from 'vitest';
import type { McpServerDefinitionRecord, McpServerReference } from '@easter-workflow-builder/db';
import type { ProcessEnvironmentPort } from '../engine-port/process-environment-port.ts';
import { resolveMcpServers } from './resolve-mcp-servers.ts';

function environmentOf(values: Readonly<Record<string, string>>): ProcessEnvironmentPort {
  const entries = new Map(Object.entries(values));
  return { read: (name) => entries.get(name) ?? null, readAll: () => values };
}

const NO_OVERRIDE: McpServerReference = { envBindings: {}, authEnvName: null };

const GITHUB: McpServerDefinitionRecord = {
  name: 'github',
  definition: {
    type: 'stdio',
    command: 'github-mcp',
    args: ['--stdio'],
    envNames: ['GITHUB_TOKEN', 'GITHUB_HOST', 'GITHUB_ORG'],
    envBindings: { GITHUB_TOKEN: 'GITHUB_TOKEN_CEG', GITHUB_HOST: 'GH_HOST_KOZPONTI' },
  },
};

const DOCS: McpServerDefinitionRecord = {
  name: 'docs',
  definition: { type: 'http', url: 'http://127.0.0.1:4100/mcp', authEnvName: 'DOCS_AUTH' },
};

const EVENTS: McpServerDefinitionRecord = {
  name: 'events',
  definition: { type: 'sse', url: 'http://127.0.0.1:4200/sse', authEnvName: null },
};

describe('resolveMcpServers', () => {
  it('a hiányzó és az üres hivatkozás mező ugyanazt az üres eredményt adja', () => {
    const environment = environmentOf({});

    expect(resolveMcpServers('a1', undefined, [GITHUB], environment)).toStrictEqual({ kind: 'ok', value: {} });
    expect(resolveMcpServers('a1', {}, [GITHUB], environment)).toStrictEqual({ kind: 'ok', value: {} });
  });

  it('a stdio ág szerver oldali neve a három szint sorrendjében oldódik fel: lépés felülírás, központi alapértelmezés, deklarált név', () => {
    const environment = environmentOf({
      GITHUB_TOKEN_SAJAT: 'token-sajat',
      GITHUB_TOKEN_CEG: 'token-ceg',
      GH_HOST_KOZPONTI: 'host-kozponti',
      GITHUB_ORG: 'org-azonos-nev',
    });
    const reference: McpServerReference = { envBindings: { GITHUB_TOKEN: 'GITHUB_TOKEN_SAJAT' }, authEnvName: null };

    expect(resolveMcpServers('a1', { github: reference }, [GITHUB], environment)).toStrictEqual({
      kind: 'ok',
      value: {
        github: {
          type: 'stdio',
          command: 'github-mcp',
          args: ['--stdio'],
          env: { GITHUB_TOKEN: 'token-sajat', GITHUB_HOST: 'host-kozponti', GITHUB_ORG: 'org-azonos-nev' },
        },
      },
    });
  });

  it('a lépés felülírása nélkül a központi alapértelmezés dönt', () => {
    const environment = environmentOf({
      GITHUB_TOKEN_CEG: 'token-ceg',
      GITHUB_TOKEN_SAJAT: 'token-sajat',
      GH_HOST_KOZPONTI: 'host',
      GITHUB_ORG: 'org',
    });

    const resolved = resolveMcpServers('a1', { github: NO_OVERRIDE }, [GITHUB], environment);

    expect(resolved).toMatchObject({ kind: 'ok', value: { github: { env: { GITHUB_TOKEN: 'token-ceg' } } } });
  });

  it('a nem deklarált névre szóló felülírás és a stdio ágon az authEnvName hatástalan', () => {
    const definition: McpServerDefinitionRecord = {
      name: 'egyszeru',
      definition: { type: 'stdio', command: 'cmd', args: [], envNames: [], envBindings: {} },
    };
    const reference: McpServerReference = { envBindings: { NEM_DEKLARALT: 'MASIK' }, authEnvName: 'MASIK' };

    expect(resolveMcpServers('a1', { egyszeru: reference }, [definition], environmentOf({ MASIK: 'x' }))).toStrictEqual(
      {
        kind: 'ok',
        value: { egyszeru: { type: 'stdio', command: 'cmd', args: [], env: {} } },
      },
    );
  });

  it('az Object.prototype nevével egyező deklarált név saját bejegyzés híján a deklarált névre oldódik fel', () => {
    const definition: McpServerDefinitionRecord = {
      name: 'proto',
      definition: { type: 'stdio', command: 'cmd', args: [], envNames: ['constructor'], envBindings: {} },
    };

    expect(
      resolveMcpServers('a1', { proto: NO_OVERRIDE }, [definition], environmentOf({ constructor: 'ertek' })),
    ).toStrictEqual({
      kind: 'ok',
      value: { proto: { type: 'stdio', command: 'cmd', args: [], env: { constructor: 'ertek' } } },
    });
  });

  it('a __proto__ nevű szerver saját kulcsként kerül az eredménybe, nem prototípusként', () => {
    const definition: McpServerDefinitionRecord = {
      name: '__proto__',
      definition: { type: 'http', url: 'http://127.0.0.1:1/mcp', authEnvName: null },
    };
    // A számított kulcs saját tulajdonságot hoz létre, a `__proto__: ...` alak a prototípust állítaná.
    const references: Readonly<Record<string, McpServerReference>> = { ['__proto__']: NO_OVERRIDE };

    const resolved = resolveMcpServers('a1', references, [definition], environmentOf({}));
    if (resolved.kind !== 'ok') {
      throw new Error(resolved.message);
    }

    expect(Object.hasOwn(resolved.value, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(resolved.value)).toBe(Object.prototype);
  });

  it('a hiányzó stdio változóra missing_mcp_server_env hibát ad a deklarált és a szerver oldali névvel, érték nélkül', () => {
    const environment = environmentOf({ GITHUB_TOKEN_CEG: 'titkos-ertek' });

    expect(resolveMcpServers('a1', { github: NO_OVERRIDE }, [GITHUB], environment)).toStrictEqual({
      kind: 'error',
      errorKind: 'missing_mcp_server_env',
      message:
        'A(z) a1 csomópont "github" MCP szerverének "GITHUB_HOST" változójához rendelt "GH_HOST_KOZPONTI" szerver oldali env változó nincs beállítva (missing_mcp_server_env).',
    });
  });

  it('a http ág Authorization fejléce a feloldott változó teljes értéke, a lépés felülírása elsőbbséget kap', () => {
    const environment = environmentOf({ DOCS_AUTH: 'Bearer kozponti', DOCS_AUTH_SAJAT: 'Bearer sajat' });

    expect(resolveMcpServers('a1', { docs: NO_OVERRIDE }, [DOCS], environment)).toStrictEqual({
      kind: 'ok',
      value: {
        docs: { type: 'http', url: 'http://127.0.0.1:4100/mcp', headers: { Authorization: 'Bearer kozponti' } },
      },
    });
    expect(
      resolveMcpServers('a1', { docs: { envBindings: {}, authEnvName: 'DOCS_AUTH_SAJAT' } }, [DOCS], environment),
    ).toStrictEqual({
      kind: 'ok',
      value: { docs: { type: 'http', url: 'http://127.0.0.1:4100/mcp', headers: { Authorization: 'Bearer sajat' } } },
    });
  });

  it('a null authEnvName mellett a sse ág fejléc nélkül megy ki, a lépés felülírása viszont fejlécet ad', () => {
    const environment = environmentOf({ EVENTS_AUTH: 'Token esemeny' });

    expect(resolveMcpServers('a1', { events: NO_OVERRIDE }, [EVENTS], environment)).toStrictEqual({
      kind: 'ok',
      value: { events: { type: 'sse', url: 'http://127.0.0.1:4200/sse' } },
    });
    expect(
      resolveMcpServers('a1', { events: { envBindings: {}, authEnvName: 'EVENTS_AUTH' } }, [EVENTS], environment),
    ).toStrictEqual({
      kind: 'ok',
      value: { events: { type: 'sse', url: 'http://127.0.0.1:4200/sse', headers: { Authorization: 'Token esemeny' } } },
    });
  });

  it('a hiányzó Authorization változóra missing_mcp_server_env hibát ad', () => {
    expect(resolveMcpServers('a1', { docs: NO_OVERRIDE }, [DOCS], environmentOf({}))).toStrictEqual({
      kind: 'error',
      errorKind: 'missing_mcp_server_env',
      message:
        'A(z) a1 csomópont "docs" MCP szerverének Authorization fejlécéhez rendelt "DOCS_AUTH" szerver oldali env változó nincs beállítva (missing_mcp_server_env).',
    });
  });

  it('a központi listában nem álló névre mcp_server_not_found hibát ad, a csomópont és a szerver nevével', () => {
    expect(resolveMcpServers('a1', { torolt: NO_OVERRIDE }, [DOCS], environmentOf({ DOCS_AUTH: 'x' }))).toStrictEqual({
      kind: 'error',
      errorKind: 'mcp_server_not_found',
      message:
        'A(z) a1 csomópont a(z) "torolt" MCP szerverre hivatkozik, ami nincs a központi MCP szerver listában (mcp_server_not_found).',
    });
  });

  it('több hivatkozott szervert egyszerre old fel', () => {
    const resolved = resolveMcpServers(
      'a1',
      { docs: NO_OVERRIDE, events: NO_OVERRIDE },
      [EVENTS, DOCS],
      environmentOf({ DOCS_AUTH: 'x' }),
    );

    expect(resolved.kind === 'ok' && Object.keys(resolved.value)).toStrictEqual(['docs', 'events']);
  });
});
