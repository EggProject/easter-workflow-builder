/* eslint-disable unicorn/no-null -- az `authEnvName` tárolt alakja `null`-lal jelöli a fejléc hiányát */
import SqliteDatabase from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { describe, expect, it } from 'vitest';
import type { Outcome } from '@easter-workflow-builder/core';
import { migrateDatabase } from '../migration/migrate-database.ts';
import { MIGRATIONS_FOLDER } from '../migration/migrations-folder.ts';
import { openDatabase } from '../sqlite-connection/open-database.ts';
import type { McpServerDefinition } from './mcp-server-definition.ts';
import { createMcpServerDefinitionRepository } from './mcp-server-definition-repository.ts';
import { mcpServerDefinitionTable } from './mcp-server-definition-table.ts';

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (outcome.kind !== 'ok') {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

const githubDefinition: McpServerDefinition = {
  type: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-github'],
  envNames: ['GITHUB_TOKEN'],
  envBindings: { GITHUB_TOKEN: 'GITHUB_TOKEN_CEG' },
};
const remoteDefinition: McpServerDefinition = { type: 'http', url: 'https://example.test/mcp', authEnvName: null };

/**
 * A `McpServerDefinitionRepository` valós `:memory:` adatbázison, az
 * `openDatabase` kompozíción és a commitolt migrációkon át (SPEC-003 12.1).
 */
describe('McpServerDefinitionRepository', () => {
  it('üres táblán üres listát ad', () => {
    const database = okOrThrow(openDatabase(':memory:'));
    expect(database.mcpServerDefinitions.listDefinitions()).toStrictEqual({ kind: 'ok', value: [] });
    database.close();
  });

  it('a mentett definíciókat név szerint növekvő sorrendben adja vissza', () => {
    const database = okOrThrow(openDatabase(':memory:'));
    okOrThrow(database.mcpServerDefinitions.saveDefinition({ name: 'remote', definition: remoteDefinition }));
    okOrThrow(database.mcpServerDefinitions.saveDefinition({ name: 'github', definition: githubDefinition }));

    expect(okOrThrow(database.mcpServerDefinitions.listDefinitions())).toStrictEqual([
      { name: 'github', definition: githubDefinition },
      { name: 'remote', definition: remoteDefinition },
    ]);
    database.close();
  });

  it('a mentés azonos névre teljesen lecseréli a definíciót, a típust is', () => {
    const database = okOrThrow(openDatabase(':memory:'));
    okOrThrow(database.mcpServerDefinitions.saveDefinition({ name: 'github', definition: githubDefinition }));
    okOrThrow(database.mcpServerDefinitions.saveDefinition({ name: 'github', definition: remoteDefinition }));

    expect(okOrThrow(database.mcpServerDefinitions.listDefinitions())).toStrictEqual([
      { name: 'github', definition: remoteDefinition },
    ]);
    database.close();
  });

  it('az üres kötelező szöveg mező blank_required_text_field, írás nélkül (a meglévő definíció megmarad)', () => {
    const database = okOrThrow(openDatabase(':memory:'));
    okOrThrow(database.mcpServerDefinitions.saveDefinition({ name: 'github', definition: githubDefinition }));

    expect(
      database.mcpServerDefinitions.saveDefinition({
        name: 'github',
        definition: { ...githubDefinition, command: ' ' },
      }),
    ).toStrictEqual({
      kind: 'error',
      message: 'A(z) "github" MCP szerver definíció "command" kötelező szöveg mezője üres (blank_required_text_field).',
    });
    expect(
      database.mcpServerDefinitions.saveDefinition({ name: 'remote', definition: { ...remoteDefinition, url: '' } }),
    ).toStrictEqual({
      kind: 'error',
      message: 'A(z) "remote" MCP szerver definíció "url" kötelező szöveg mezője üres (blank_required_text_field).',
    });
    expect(okOrThrow(database.mcpServerDefinitions.listDefinitions())).toStrictEqual([
      { name: 'github', definition: githubDefinition },
    ]);
    database.close();
  });

  it('a törlés eltávolítja a sort, a nem létező név not_found', () => {
    const database = okOrThrow(openDatabase(':memory:'));
    okOrThrow(database.mcpServerDefinitions.saveDefinition({ name: 'github', definition: githubDefinition }));

    expect(database.mcpServerDefinitions.deleteDefinition('github')).toStrictEqual({ kind: 'ok', value: undefined });
    expect(okOrThrow(database.mcpServerDefinitions.listDefinitions())).toStrictEqual([]);
    const missing = database.mcpServerDefinitions.deleteDefinition('github');
    expect(missing.kind === 'error' ? missing.message : '').toContain('(not_found)');
    database.close();
  });

  it('egy korrupt definíció sor corrupt_mcp_server_definition hibát ad', () => {
    // Közvetlen tábla hozzáférés kell a korrupt sorhoz, ezért a repository itt a
    // factoryval, tranzakció burkoló nélkül épül.
    const sqlite = new SqliteDatabase(':memory:');
    const database = drizzle(sqlite);
    migrateDatabase(database, MIGRATIONS_FOLDER);
    const repository = createMcpServerDefinitionRepository(database, (work) => work());
    database
      .insert(mcpServerDefinitionTable)
      .values({ name: 'rossz', definition: { type: 'stdio', command: 'x', args: [], envNames: [], env: { A: 'B' } } })
      .run();

    const listed = repository.listDefinitions();
    expect(listed.kind === 'error' ? listed.message : '').toContain('"rossz"');
    expect(listed.kind === 'error' ? listed.message : '').toContain('(corrupt_mcp_server_definition)');
    sqlite.close();
  });
});
