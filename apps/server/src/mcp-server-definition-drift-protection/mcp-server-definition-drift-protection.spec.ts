/* eslint-disable unicorn/no-null -- az authEnvName nullázható mezője a dróton ténylegesen `null` értéket hordozza */
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  isMcpServerDefinition,
  type McpServerDefinition as DatabaseMcpServerDefinition,
  type McpServerDefinitionRecord as DatabaseMcpServerDefinitionRecord,
} from '@easter-workflow-builder/db';
import {
  McpServerDefinitionSchema,
  type McpServerDefinition as ProtocolMcpServerDefinition,
  type McpServerDefinitionRecord as ProtocolMcpServerDefinitionRecord,
} from '@easter-workflow-builder/protocol';

/**
 * A központi MCP szerver definíció sodródás elleni védelme (SPEC-009 6.1,
 * `.claude/CLAUDE.md` 5. szekció): a `protocol` (L1) a `db` (L2) három ágú
 * unióját nem importálhatja, ezért szándékosan duplikálja; az `apps/server`
 * az egyetlen csomag, ahol a két oldal egyszerre látszik. A
 * `node-config-drift-protection` mintája: megvalósítás nélküli regressziós
 * teszt, típusszintű kétirányú egyenlőség a `typecheck` kapun, plusz
 * futásidejű ág a `db` `isMcpServerDefinition` guardján.
 *
 * A `protocol` a név alakjára szigorúbb (env változó név, a hozzárendelés
 * kulcsa deklarált név): ez a mentési szabály, a `db` alakot ellenőriz. A
 * futásidejű ág ezért egyirányú a név szabályra: ami a sémán átmegy, az a
 * guardon is; az alakhiba mindkét oldalon elbukik.
 */
describe('a protokoll és a db központi MCP definíciója kétirányban megegyezik', () => {
  it('McpServerDefinition és McpServerDefinitionRecord', () => {
    expectTypeOf<ProtocolMcpServerDefinition>().toEqualTypeOf<DatabaseMcpServerDefinition>();
    expectTypeOf<ProtocolMcpServerDefinitionRecord>().toEqualTypeOf<DatabaseMcpServerDefinitionRecord>();
  });
});

const VALID_DEFINITIONS: readonly unknown[] = [
  {
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    envNames: ['GITHUB_TOKEN'],
    envBindings: { GITHUB_TOKEN: 'GITHUB_TOKEN_CEG' },
  },
  { type: 'stdio', command: 'node', args: [], envNames: [], envBindings: {} },
  { type: 'sse', url: 'https://x.test/sse', authEnvName: 'SSE_AUTH' },
  { type: 'http', url: 'https://x.test/mcp', authEnvName: null },
];

const SHAPE_ERROR_DEFINITIONS: readonly unknown[] = [
  { type: 'sdk' },
  { type: 'stdio', command: 'node', args: [], envNames: [], envBindings: {}, env: { A: 'titok' } },
  { type: 'stdio', command: 'node', args: [], envNames: [] },
  { type: 'sse', url: 'https://x.test/sse', authEnvName: null, headers: { Authorization: 'titok' } },
  { type: 'http', url: 1, authEnvName: null },
];

describe('a protokoll és a db futásidőben is ugyanúgy dönt', () => {
  it.each(VALID_DEFINITIONS.map((definition) => [definition]))('mindkét oldalon átmegy: %j', (definition) => {
    expect(McpServerDefinitionSchema.safeParse(definition).success).toBe(true);
    expect(isMcpServerDefinition(definition)).toBe(true);
  });

  it.each(SHAPE_ERROR_DEFINITIONS.map((definition) => [definition]))('mindkét oldalon elbukik: %j', (definition) => {
    expect(McpServerDefinitionSchema.safeParse(definition).success).toBe(false);
    expect(isMcpServerDefinition(definition)).toBe(false);
  });
});
