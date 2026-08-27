import SqliteDatabase from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { getTableConfig, SQLiteColumn } from 'drizzle-orm/sqlite-core';
import { describe, expect, it } from 'vitest';
import { migrateDatabase } from '../migration/migrate-database.ts';
import { MIGRATIONS_FOLDER } from '../migration/migrations-folder.ts';
import { workflowTable } from './workflow.ts';

/**
 * A `workflowTable` séma valós SQLite ellen: a commitolt migráció tényleg
 * létrehozza a táblát a séma definícióban leírt oszlopokkal, és az
 * opcionális oszlopok (`description`, `providerId`) NULL értéket engednek.
 */
describe('workflowTable', () => {
  it('ki-be írja a kötelező és opcionális oszlopokat', () => {
    const sqlite = new SqliteDatabase(':memory:');
    const database = drizzle(sqlite);
    expect(migrateDatabase(database, MIGRATIONS_FOLDER).kind).toBe('ok');

    database
      .insert(workflowTable)
      .values({
        id: 'workflow-1',
        name: 'Első workflow',
        description: 'Leírás',
        providerId: 'minimax',
        createdAtMs: new Date(0),
        updatedAtMs: new Date(1000),
      })
      .run();

    const row = database.select().from(workflowTable).where(eq(workflowTable.id, 'workflow-1')).get();
    expect(row).toStrictEqual({
      id: 'workflow-1',
      name: 'Első workflow',
      description: 'Leírás',
      providerId: 'minimax',
      createdAtMs: new Date(0),
      updatedAtMs: new Date(1000),
    });

    sqlite.close();
  });

  it('a description és a providerId oszlop NULL maradhat', () => {
    const sqlite = new SqliteDatabase(':memory:');
    const database = drizzle(sqlite);
    migrateDatabase(database, MIGRATIONS_FOLDER);

    database
      .insert(workflowTable)
      .values({
        id: 'workflow-2',
        name: 'Második workflow',
        createdAtMs: new Date(0),
        updatedAtMs: new Date(0),
      })
      .run();

    const row = database.select().from(workflowTable).where(eq(workflowTable.id, 'workflow-2')).get();
    expect(row?.description).toBeNull();
    expect(row?.providerId).toBeNull();

    sqlite.close();
  });

  it('az updated_at_ms oszlopon indexet definiál', () => {
    const [updatedAtIndex] = getTableConfig(workflowTable).indexes;
    expect(updatedAtIndex?.config.name).toBe('workflow_updated_at_idx');
    expect(updatedAtIndex?.config.unique).toBe(false);

    const [indexedColumn] = updatedAtIndex?.config.columns ?? [];
    if (!(indexedColumn instanceof SQLiteColumn)) {
      throw new TypeError('váratlan index oszlop típus');
    }
    expect(indexedColumn.name).toBe('updated_at_ms');
  });
});
