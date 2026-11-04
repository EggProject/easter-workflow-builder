import SqliteDatabase from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { describe, expect, it } from 'vitest';
import { migrateDatabase } from '../migration/migrate-database.ts';
import { MIGRATIONS_FOLDER } from '../migration/migrations-folder.ts';
import { mcpServerDefinitionTable } from './mcp-server-definition-table.ts';

/**
 * A `mcpServerDefinitionTable` séma valós SQLite ellen, a commitolt
 * migrációkkal: a tábla üresen indul, a név elsődleges kulcs, és a tábla
 * nem hivatkozik más táblára.
 */
describe('mcpServerDefinitionTable', () => {
  it('a migrált adatbázison a tábla üres, a JSON oszlop visszaolvasható', () => {
    const sqlite = new SqliteDatabase(':memory:');
    const database = drizzle(sqlite);
    expect(migrateDatabase(database, MIGRATIONS_FOLDER).kind).toBe('ok');
    expect(database.select().from(mcpServerDefinitionTable).all()).toStrictEqual([]);

    database
      .insert(mcpServerDefinitionTable)
      .values({ name: 'github', definition: { type: 'http', url: 'https://example.test' } })
      .run();
    expect(database.select().from(mcpServerDefinitionTable).all()).toStrictEqual([
      { name: 'github', definition: { type: 'http', url: 'https://example.test' } },
    ]);

    sqlite.close();
  });

  it('ugyanaz a név másodszor SQLITE_CONSTRAINT_PRIMARYKEY hibával bukik', () => {
    const sqlite = new SqliteDatabase(':memory:');
    const database = drizzle(sqlite);
    migrateDatabase(database, MIGRATIONS_FOLDER);
    database.insert(mcpServerDefinitionTable).values({ name: 'github', definition: {} }).run();

    let caughtError: unknown;
    try {
      database.insert(mcpServerDefinitionTable).values({ name: 'github', definition: {} }).run();
    } catch (error) {
      caughtError = error;
    }
    expect(caughtError instanceof SqliteDatabase.SqliteError ? caughtError.code : '').toBe(
      'SQLITE_CONSTRAINT_PRIMARYKEY',
    );

    sqlite.close();
  });

  it('nincs indexe és idegen kulcsa (O-43: a hivatkozás nem idegen kulcs)', () => {
    const config = getTableConfig(mcpServerDefinitionTable);
    expect(config.name).toBe('mcp_server_definition');
    expect(config.indexes).toStrictEqual([]);
    expect(config.foreignKeys).toStrictEqual([]);
  });
});
