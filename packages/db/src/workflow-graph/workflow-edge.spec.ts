import SqliteDatabase from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { getTableConfig, type ForeignKey } from 'drizzle-orm/sqlite-core';
import { describe, expect, it } from 'vitest';
import { migrateDatabase } from '../migration/migrate-database.ts';
import { MIGRATIONS_FOLDER } from '../migration/migrations-folder.ts';
import { workflowTable } from './workflow.ts';
import { workflowNodeTable } from './workflow-node.ts';
import { workflowEdgeTable } from './workflow-edge.ts';

function openMigratedDatabase(): { sqlite: SqliteDatabase.Database; database: BetterSQLite3Database } {
  const sqlite = new SqliteDatabase(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const database = drizzle(sqlite);
  migrateDatabase(database, MIGRATIONS_FOLDER);
  return { sqlite, database };
}

function insertWorkflowWithTwoNodes(database: BetterSQLite3Database): void {
  database
    .insert(workflowTable)
    .values({ id: 'workflow-1', name: 'W1', createdAtMs: new Date(0), updatedAtMs: new Date(0) })
    .run();
  database
    .insert(workflowNodeTable)
    .values([
      {
        id: 'node-a',
        workflowId: 'workflow-1',
        type: 'prompt',
        label: 'A',
        positionX: 0,
        positionY: 0,
        config: {},
        createdAtMs: new Date(0),
        updatedAtMs: new Date(0),
      },
      {
        id: 'node-b',
        workflowId: 'workflow-1',
        type: 'prompt',
        label: 'B',
        positionX: 1,
        positionY: 1,
        config: {},
        createdAtMs: new Date(0),
        updatedAtMs: new Date(0),
      },
    ])
    .run();
}

function findForeignKeyByLocalColumn(foreignKeys: readonly ForeignKey[], localColumnName: string): ForeignKey {
  const found = foreignKeys.find((foreignKey) => foreignKey.reference().columns[0]?.name === localColumnName);
  if (found === undefined) {
    throw new TypeError(`nincs idegen kulcs a(z) ${localColumnName} oszlopon`);
  }
  return found;
}

/**
 * A `workflowEdgeTable` séma valós SQLite ellen: a `source_node_id` és a
 * `target_node_id` idegen kulcs `ON DELETE CASCADE` a node törlésekor az élt
 * is törli (SPEC-003 4.7 szekció).
 */
describe('workflowEdgeTable', () => {
  it('ki-be írja az él sort a forrás és cél node azonosítóval', () => {
    const { sqlite, database } = openMigratedDatabase();
    insertWorkflowWithTwoNodes(database);

    database
      .insert(workflowEdgeTable)
      .values({
        id: 'edge-1',
        workflowId: 'workflow-1',
        sourceNodeId: 'node-a',
        targetNodeId: 'node-b',
        sourceHandle: 'out',
        targetHandle: 'in',
        branchKey: 'true',
        createdAtMs: new Date(0),
      })
      .run();

    const row = database.select().from(workflowEdgeTable).where(eq(workflowEdgeTable.id, 'edge-1')).get();
    expect(row).toStrictEqual({
      id: 'edge-1',
      workflowId: 'workflow-1',
      sourceNodeId: 'node-a',
      targetNodeId: 'node-b',
      sourceHandle: 'out',
      targetHandle: 'in',
      branchKey: 'true',
      createdAtMs: new Date(0),
    });

    sqlite.close();
  });

  it('a forrás node törlése kaszkádoltan törli az élt', () => {
    const { sqlite, database } = openMigratedDatabase();
    insertWorkflowWithTwoNodes(database);
    database
      .insert(workflowEdgeTable)
      .values({
        id: 'edge-2',
        workflowId: 'workflow-1',
        sourceNodeId: 'node-a',
        targetNodeId: 'node-b',
        createdAtMs: new Date(0),
      })
      .run();

    database.delete(workflowNodeTable).where(eq(workflowNodeTable.id, 'node-a')).run();

    const rows = database.select().from(workflowEdgeTable).where(eq(workflowEdgeTable.id, 'edge-2')).all();
    expect(rows).toStrictEqual([]);

    sqlite.close();
  });

  it('a három idegen kulcs ON DELETE CASCADE-del a helyes táblára mutat', () => {
    const config = getTableConfig(workflowEdgeTable);
    expect(config.indexes.map((index) => index.config.name)).toStrictEqual([
      'workflow_edge_workflow_idx',
      'workflow_edge_source_idx',
      'workflow_edge_target_idx',
    ]);

    const workflowIdForeignKey = findForeignKeyByLocalColumn(config.foreignKeys, 'workflow_id');
    expect(workflowIdForeignKey.onDelete).toBe('cascade');
    expect(workflowIdForeignKey.reference().foreignTable).toBe(workflowTable);

    const sourceNodeIdForeignKey = findForeignKeyByLocalColumn(config.foreignKeys, 'source_node_id');
    expect(sourceNodeIdForeignKey.onDelete).toBe('cascade');
    expect(sourceNodeIdForeignKey.reference().foreignTable).toBe(workflowNodeTable);

    const targetNodeIdForeignKey = findForeignKeyByLocalColumn(config.foreignKeys, 'target_node_id');
    expect(targetNodeIdForeignKey.onDelete).toBe('cascade');
    expect(targetNodeIdForeignKey.reference().foreignTable).toBe(workflowNodeTable);
  });
});
