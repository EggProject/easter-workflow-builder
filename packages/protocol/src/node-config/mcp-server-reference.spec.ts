/* eslint-disable unicorn/no-null -- az authEnvName nullázható mezője a dróton ténylegesen `null` értéket hordozza */
import { describe, expect, it } from 'vitest';
import { McpServerReferenceSchema } from './mcp-server-reference.ts';

// A `JSON.parse` saját `__proto__` tulajdonságot hoz létre (egy objektum literál a prototípust állítaná).
const OWN_PROTO_KEY_1: unknown = JSON.parse('{"envBindings":{"__proto__":"X"},"authEnvName":null}');

describe('McpServerReferenceSchema', () => {
  it('a felülírás nélküli és a kitöltött hivatkozást elfogadja', () => {
    expect(McpServerReferenceSchema.safeParse({ envBindings: {}, authEnvName: null }).success).toBe(true);
    expect(
      McpServerReferenceSchema.safeParse({ envBindings: { GITHUB_TOKEN: 'GITHUB_TOKEN_CEG' }, authEnvName: 'AUTH' })
        .success,
    ).toBe(true);
  });

  it.each([
    ['ismeretlen kulcs (érték rekord)', { envBindings: {}, authEnvName: null, env: { A: 'titok' } }],
    ['hiányzó envBindings', { authEnvName: null }],
    ['nem név értékű envBindings', { envBindings: { A: 1 }, authEnvName: null }],
    ['nem név authEnvName', { envBindings: {}, authEnvName: 1 }],
    ['saját __proto__ kulcsú envBindings (T-012-27)', OWN_PROTO_KEY_1],
  ])('elutasítja: %s', (_label, value) => {
    expect(McpServerReferenceSchema.safeParse(value).success).toBe(false);
  });
});
