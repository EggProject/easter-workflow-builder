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
function openMigratedDatabase(options: { foreignKeys?: boolean } = {}): {
  sqlite: SqliteDatabase.Database;
  database: BetterSQLite3Database;
} {
  const sqlite = new SqliteDatabase(':memory:');
  // A `better-sqlite3` 13.0.3 ténylegesen bekapcsolt `foreign_keys` pragmával
  // nyit (saját mérés, nem az F-1 által hivatkozott, a puszta SQLite
  // könyvtárra vonatkozó kikapcsolt alapértelmezés), ezért a "pragma nélküli"
  // ághoz **explicit ki kell kapcsolni**, nem elég kihagyni a bekapcsolást.
  sqlite.pragma(options.foreignKeys === false ? 'foreign_keys = OFF' : 'foreign_keys = ON');
  const database = drizzle(sqlite);
  migrateDatabase(database, MIGRATIONS_FOLDER);
  return { sqlite, database };
}

/**
 * Egy workflow és egy hozzá tartozó node sor, a kaszkád vizsgálatához.
 */
function seedWorkflowWithNode(database: BetterSQLite3Database, workflowId: string, nodeId: string): void {
  database
    .insert(workflowTable)
    .values({ id: workflowId, name: workflowId, createdAtMs: new Date(0), updatedAtMs: new Date(0) })
    .run();
  database
    .insert(workflowNodeTable)
    .values({
      id: nodeId,
      workflowId,
      type: 'start',
      label: 'Node',
      positionX: 0,
      positionY: 0,
      config: {},
      createdAtMs: new Date(0),
      updatedAtMs: new Date(0),
    })
    .run();
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

  it('kikapcsolt foreign_keys pragma mellett a kaszkád NEM fut le, bekapcsolt mellett igen (12. kritérium)', () => {
    // Ugyanaz a séma, ugyanaz a törlés, egyetlen különbség a kapcsolatonként
    // beállított `foreign_keys` pragma (F-1, F-2). Ez az a teszt, ami
    // igazolja, hogy a pragma nem díszítés: nélküle a törlés csendben árva
    // sort hagy, tehát a 3. user döntés (végleges törlés mindennel együtt)
    // sérülne, ha az `openDatabase` valaha kihagyná a bekapcsolást (10.2).
    const withoutForeignKeys = openMigratedDatabase({ foreignKeys: false });
    seedWorkflowWithNode(withoutForeignKeys.database, 'workflow-fk-off', 'node-fk-off');
    withoutForeignKeys.database.delete(workflowTable).where(eq(workflowTable.id, 'workflow-fk-off')).run();
    const orphanRows = withoutForeignKeys.database
      .select()
      .from(workflowNodeTable)
      .where(eq(workflowNodeTable.workflowId, 'workflow-fk-off'))
      .all();
    expect(orphanRows).toHaveLength(1);
    withoutForeignKeys.sqlite.close();

    const withForeignKeys = openMigratedDatabase();
    seedWorkflowWithNode(withForeignKeys.database, 'workflow-fk-on', 'node-fk-on');
    withForeignKeys.database.delete(workflowTable).where(eq(workflowTable.id, 'workflow-fk-on')).run();
    const cascadedRows = withForeignKeys.database
      .select()
      .from(workflowNodeTable)
      .where(eq(workflowNodeTable.workflowId, 'workflow-fk-on'))
      .all();
    expect(cascadedRows).toStrictEqual([]);
    withForeignKeys.sqlite.close();
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
