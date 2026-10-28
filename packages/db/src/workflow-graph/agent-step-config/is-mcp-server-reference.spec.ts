/* eslint-disable unicorn/no-null -- az `authEnvName` tárolt alakja `null`-lal jelzi, hogy nincs felülírás (SPEC-009 6.2) */
import { describe, expect, expectTypeOf, it } from 'vitest';
import { isMcpServerReference } from './is-mcp-server-reference.ts';
import type { McpServerReference } from './mcp-server-reference.ts';

// A `JSON.parse` saját `__proto__` tulajdonságot hoz létre (egy objektum literál a prototípust állítaná).
const OWN_PROTO_KEY_1: unknown = JSON.parse('{"envBindings":{"__proto__":"X"},"authEnvName":null}');

describe('isMcpServerReference', () => {
  it('elfogadja a felülírás nélküli és a felülírást hordozó hivatkozást', () => {
    expect(isMcpServerReference({ envBindings: {}, authEnvName: null })).toBe(true);
    expect(isMcpServerReference({ envBindings: { TOKEN: 'TOKEN_CEG' }, authEnvName: 'AUTH_CEG' })).toBe(true);
  });

  it.each([
    ['nem objektum', 'hivatkozas'],
    ['null', null],
    ['hiányzó envBindings', { authEnvName: null }],
    ['hiányzó authEnvName', { envBindings: {} }],
    ['nem szöveg értékű envBindings', { envBindings: { TOKEN: 1 }, authEnvName: null }],
    ['szám authEnvName', { envBindings: {}, authEnvName: 7 }],
    ['ismeretlen kulcs', { envBindings: {}, authEnvName: null, env: { TOKEN: 'ertek' } }],
    ['saját __proto__ kulcsú envBindings (T-012-27)', OWN_PROTO_KEY_1],
  ])('elutasítja: %s', (_name, value) => {
    expect(isMcpServerReference(value)).toBe(false);
  });

  it('a típust McpServerReference-re szűkíti', () => {
    const value: unknown = { envBindings: {}, authEnvName: null };
    if (isMcpServerReference(value)) {
      expectTypeOf(value).toEqualTypeOf<McpServerReference>();
    }
  });
});
