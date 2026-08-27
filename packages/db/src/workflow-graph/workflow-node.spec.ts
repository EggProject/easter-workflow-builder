import SqliteDatabase from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { describe, expect, it } from 'vitest';
import { migrateDatabase } from '../migration/migrate-database.ts';
import { MIGRATIONS_FOLDER } from '../migration/migrations-folder.ts';
import { workflowTable } from './workflow.ts';
import { workflowNodeTable } from './workflow-node.ts';

/**
 * A `workflowNodeTable` séma valós SQLite ellen: a `config` JSON oszlop
 * kerekre fordul (`mode: 'json'`), és a `workflow_id` idegen kulcs
 * `ON DELETE CASCADE` tényleg törli a gyerek sort (SPEC-003 4.2 szekció).
 */
function openMigratedDatabase(): { sqlite: SqliteDatabase.Database; database: BetterSQLite3Database } {
  const sqlite = new SqliteDatabase(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const database = drizzle(sqlite);
  migrateDatabase(database, MIGRATIONS_FOLDER);
  return { sqlite, database };
}

describe('workflowNodeTable', () => {
  it('ki-be írja a node sort, a config oszloppal együtt', () => {
    const { sqlite, database } = openMigratedDatabase();

    database
      .insert(workflowTable)
      .values({ id: 'workflow-1', name: 'W1', createdAtMs: new Date(0), updatedAtMs: new Date(0) })
      .run();

    database
      .insert(workflowNodeTable)
      .values({
        id: 'node-1',
        workflowId: 'workflow-1',
        type: 'prompt',
        label: 'Első lépés',
        positionX: 12.5,
        positionY: -3,
        config: { model: 'claude', temperature: 0.5 },
        createdAtMs: new Date(0),
        updatedAtMs: new Date(0),
      })
      .run();

    const row = database.select().from(workflowNodeTable).where(eq(workflowNodeTable.id, 'node-1')).get();
    expect(row?.config).toStrictEqual({ model: 'claude', temperature: 0.5 });
    expect(row?.positionX).toBe(12.5);

    sqlite.close();
  });

  it('a szülő workflow törlése kaszkádoltan törli a node sort', () => {
    const { sqlite, database } = openMigratedDatabase();

    database
      .insert(workflowTable)
      .values({ id: 'workflow-2', name: 'W2', createdAtMs: new Date(0), updatedAtMs: new Date(0) })
      .run();
    database
      .insert(workflowNodeTable)
      .values({
        id: 'node-2',
        workflowId: 'workflow-2',
        type: 'prompt',
        label: 'Node',
        positionX: 0,
        positionY: 0,
        config: {},
        createdAtMs: new Date(0),
        updatedAtMs: new Date(0),
      })
      .run();

    database.delete(workflowTable).where(eq(workflowTable.id, 'workflow-2')).run();

    const rows = database.select().from(workflowNodeTable).where(eq(workflowNodeTable.workflowId, 'workflow-2')).all();
    expect(rows).toStrictEqual([]);

    sqlite.close();
  });

  it('a workflow_id idegen kulcs ON DELETE CASCADE-del a workflow táblára mutat', () => {
    const config = getTableConfig(workflowNodeTable);

    const [workflowIdIndex] = config.indexes;
    expect(workflowIdIndex?.config.name).toBe('workflow_node_workflow_idx');

    const [foreignKey] = config.foreignKeys;
    expect(foreignKey?.onDelete).toBe('cascade');
    const reference = foreignKey?.reference();
    expect(reference?.foreignTable).toBe(workflowTable);
    expect(reference?.columns.map((column) => column.name)).toStrictEqual(['workflow_id']);
    expect(reference?.foreignColumns.map((column) => column.name)).toStrictEqual(['id']);
  });
});
