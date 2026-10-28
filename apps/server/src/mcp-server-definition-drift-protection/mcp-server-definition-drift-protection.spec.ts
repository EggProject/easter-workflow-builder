/* eslint-disable unicorn/no-null -- az authEnvName nullázható mezője a dróton ténylegesen `null` értéket hordozza */
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  isMcpServerDefinition,
  MCP_SERVER_DEFINITION_REQUIRED_TEXT_FIELDS as DATABASE_REQUIRED_TEXT_FIELDS,
  openDatabase,
  type McpServerDefinition as DatabaseMcpServerDefinition,
  type McpServerDefinitionRecord as DatabaseMcpServerDefinitionRecord,
} from '@easter-workflow-builder/db';
import {
  MCP_SERVER_DEFINITION_REQUIRED_TEXT_FIELDS as PROTOCOL_REQUIRED_TEXT_FIELDS,
  McpServerDefinitionSaveSchema,
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
  { type: 'stdio', command: 'node', args: [], envNames: ['A'], envBindings: { A: 1 } },
  { type: 'stdio', command: 'node', args: [1], envNames: [], envBindings: {} },
  { type: 'sse', url: 'https://x.test/sse', authEnvName: 7 },
  { type: 'http', url: 'https://x.test/mcp', authEnvName: { name: 'A' } },
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

/**
 * A kötelező szöveg mező szabály (SPEC-009 6.1; a `node-config-drift-protection`
 * kötelező szöveg mező ágának mintája): a két tábla típusszinten egyenlő, és
 * mezőnként mindkét írási oldal (a `protocol` mentési sémája és a `db`
 * `saveDefinition`) ugyanazt az üres értéket utasítja el, a kitöltöttet
 * átengedi.
 */
describe('a kötelező szöveg mező tábla és a két írási oldal ugyanúgy dönt', () => {
  it('a két tábla típusszinten és értékre egyenlő', () => {
    expectTypeOf<typeof PROTOCOL_REQUIRED_TEXT_FIELDS>().toEqualTypeOf<typeof DATABASE_REQUIRED_TEXT_FIELDS>();
    expect(PROTOCOL_REQUIRED_TEXT_FIELDS).toStrictEqual(DATABASE_REQUIRED_TEXT_FIELDS);
  });

  const blankCases: readonly (readonly [DatabaseMcpServerDefinition, string])[] = [
    [{ type: 'stdio', command: ' ', args: [], envNames: [], envBindings: {} }, 'command'],
    [{ type: 'sse', url: '', authEnvName: null }, 'url'],
    [{ type: 'http', url: '  ', authEnvName: null }, 'url'],
  ];

  it.each(blankCases)('az üres mezőt mindkét oldal elutasítja: %j', (definition, field) => {
    const parsed = McpServerDefinitionSaveSchema.safeParse(definition);
    expect(parsed.success ? [] : parsed.error.issues.map((issue) => issue.path)).toStrictEqual([[field]]);
    const database = openDatabase(':memory:');
    if (database.kind !== 'ok') {
      throw new Error(database.message);
    }
    const saved = database.value.mcpServerDefinitions.saveDefinition({ name: 'proba', definition });
    expect(saved.kind === 'error' ? saved.message : '').toContain(`"${field}" kötelező szöveg mezője üres`);
    database.value.close();
  });

  it.each(VALID_DEFINITIONS.filter(isMcpServerDefinition).map((definition) => [definition]))(
    'a kitöltött mezőt mindkét oldal átengedi: %j',
    (definition) => {
      expect(McpServerDefinitionSaveSchema.safeParse(definition).success).toBe(true);
      const database = openDatabase(':memory:');
      if (database.kind !== 'ok') {
        throw new Error(database.message);
      }
      expect(database.value.mcpServerDefinitions.saveDefinition({ name: 'proba', definition })).toStrictEqual({
        kind: 'ok',
        value: undefined,
      });
      database.value.close();
    },
  );
});
