import SqliteDatabase from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { getTableConfig, type ForeignKey } from 'drizzle-orm/sqlite-core';
import { describe, expect, it } from 'vitest';
import { migrateDatabase } from '../migration/migrate-database.ts';
import { MIGRATIONS_FOLDER } from '../migration/migrations-folder.ts';
import { computeSnapshotHash } from '../graph-snapshot/compute-snapshot-hash.ts';
import { graphSnapshotTable } from '../graph-snapshot/graph-snapshot.ts';
import { workflowTable } from '../workflow-graph/workflow.ts';
import { workflowRunTable } from './workflow-run.ts';

/**
 * Az `openDatabase`/`DatabaseContext` felület nem exportálja a nyers
 * `better-sqlite3` handle-t, és a `WorkflowRunRepository` még nem létezik
 * (T-003-16), ezért a teszt saját `better-sqlite3` + `drizzle()` példányt
 * nyit, és a commitolt migrációkat a `migrateDatabase` segéddel futtatja le
 * rajta, ugyanúgy, ahogy a `workflow-graph` és a `graph-snapshot` téma
 * tábla tesztjei teszik (`workflow-edge.spec.ts`,
 * `graph-snapshot-immutability.spec.ts`).
 */
function openMigratedDatabase(): { sqlite: SqliteDatabase.Database; database: BetterSQLite3Database } {
  const sqlite = new SqliteDatabase(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const database = drizzle(sqlite);
  migrateDatabase(database, MIGRATIONS_FOLDER);
  return { sqlite, database };
}

function findForeignKeyByLocalColumn(foreignKeys: readonly ForeignKey[], localColumnName: string): ForeignKey {
  const found = foreignKeys.find((foreignKey) => foreignKey.reference().columns[0]?.name === localColumnName);
  if (found === undefined) {
    throw new TypeError(`nincs idegen kulcs a(z) ${localColumnName} oszlopon`);
  }
  return found;
}

function insertWorkflow(database: BetterSQLite3Database, id: string): void {
  database
    .insert(workflowTable)
    .values({ id, name: id, createdAtMs: new Date(0), updatedAtMs: new Date(0) })
    .run();
}

/**
 * Beszúr egy `graph_snapshot` sort, és visszaadja a lenyomatát.
 */
function insertGraphSnapshot(database: BetterSQLite3Database, seed: string): string {
  const document = { version: 1, workflow: { id: seed } };
  const hash = computeSnapshotHash(`${seed}:${JSON.stringify(document)}`);
  database
    .insert(graphSnapshotTable)
    .values({ hash, documentVersion: 1, document, firstCapturedAtMs: new Date(0) })
    .run();
  return hash;
}

interface WorkflowRunSeed {
  id: string;
  workflowId: string;
  rootRunId: string;
  graphSnapshotHash: string;
  restartedFromRunId?: string;
}

function insertWorkflowRun(database: BetterSQLite3Database, seed: WorkflowRunSeed): void {
  database
    .insert(workflowRunTable)
    .values({
      id: seed.id,
      workflowId: seed.workflowId,
      status: 'pending',
      input: {},
      providerId: 'minimax',
      rootRunId: seed.rootRunId,
      depth: 0,
      workflowAncestry: [seed.workflowId],
      graphSnapshotHash: seed.graphSnapshotHash,
      persistedStreamDeltas: false,
      restartedFromRunId: seed.restartedFromRunId,
      createdAtMs: new Date(0),
    })
    .run();
}

/**
 * A `workflowRunTable` séma valós SQLite ellen: a commitolt migráció
 * tényleg létrehozza a táblát a SPEC-003 4.8 szekció szerinti oszlopokkal,
 * a négy idegen kulcs a helyes cél táblára és `ON DELETE` viselkedésre
 * mutat, és a 4.15 szekció kaszkád lánca (a `workflow_run` szegmense) és a
 * `graph_snapshot_hash` `RESTRICT` védelme (51. kritérium) futtatott
 * teszttel igazolt.
 */
describe('workflowRunTable', () => {
  it('ki-be írja a kötelező oszlopokat, a nullable oszlopok is kitöltve', () => {
    const { sqlite, database } = openMigratedDatabase();
    insertWorkflow(database, 'workflow-1');
    const hash = insertGraphSnapshot(database, 'workflow-1');
    insertWorkflowRun(database, {
      id: 'run-original',
      workflowId: 'workflow-1',
      rootRunId: 'run-original',
      graphSnapshotHash: hash,
    });

    database
      .insert(workflowRunTable)
      .values({
        id: 'run-restarted',
        workflowId: 'workflow-1',
        status: 'succeeded',
        input: { foo: 'bar' },
        providerId: 'claude-subscription',
        rootRunId: 'run-restarted',
        depth: 0,
        workflowAncestry: ['workflow-1'],
        graphSnapshotHash: hash,
        persistedStreamDeltas: true,
        restartedFromRunId: 'run-original',
        createdAtMs: new Date(0),
        startedAtMs: new Date(1000),
        finishedAtMs: new Date(2000),
        errorKind: 'timeout',
        errorMessage: 'A futás túllépte az időkeretet.',
      })
      .run();

    const row = database.select().from(workflowRunTable).where(eq(workflowRunTable.id, 'run-restarted')).get();
    expect(row).toStrictEqual({
      id: 'run-restarted',
      workflowId: 'workflow-1',
      status: 'succeeded',
      input: { foo: 'bar' },
      providerId: 'claude-subscription',
      rootRunId: 'run-restarted',
      depth: 0,
      workflowAncestry: ['workflow-1'],
      graphSnapshotHash: hash,
      persistedStreamDeltas: true,
      restartedFromRunId: 'run-original',
      createdAtMs: new Date(0),
      startedAtMs: new Date(1000),
      finishedAtMs: new Date(2000),
      errorKind: 'timeout',
      errorMessage: 'A futás túllépte az időkeretet.',
    });

    sqlite.close();
  });

  it('a nullable oszlopok NULL maradhatnak, a persisted_stream_deltas hamis értéket ír-olvas', () => {
    const { sqlite, database } = openMigratedDatabase();
    insertWorkflow(database, 'workflow-1');
    const hash = insertGraphSnapshot(database, 'workflow-1');
    insertWorkflowRun(database, {
      id: 'run-1',
      workflowId: 'workflow-1',
      rootRunId: 'run-1',
      graphSnapshotHash: hash,
    });

    const row = database.select().from(workflowRunTable).where(eq(workflowRunTable.id, 'run-1')).get();
    expect(row?.restartedFromRunId).toBeNull();
    expect(row?.startedAtMs).toBeNull();
    expect(row?.finishedAtMs).toBeNull();
    expect(row?.errorKind).toBeNull();
    expect(row?.errorMessage).toBeNull();
    expect(row?.persistedStreamDeltas).toBe(false);

    sqlite.close();
  });

  it('a négy indexet a spec szerinti néven és oszlopon definiálja', () => {
    const config = getTableConfig(workflowRunTable);
    expect(config.indexes.map((index) => index.config.name)).toStrictEqual([
      'workflow_run_workflow_created_idx',
      'workflow_run_status_idx',
      'workflow_run_root_idx',
      'workflow_run_snapshot_idx',
    ]);

    const [workflowCreatedIndex] = config.indexes;
    const workflowCreatedColumnNames = (workflowCreatedIndex?.config.columns ?? []).map((column) => {
      if (typeof column === 'string' || !('name' in column)) {
        throw new TypeError('váratlan index oszlop típus');
      }
      return column.name;
    });
    expect(workflowCreatedColumnNames).toStrictEqual(['workflow_id', 'created_at_ms']);
  });

  it('a négy idegen kulcs a helyes cél táblára és ON DELETE viselkedésre mutat', () => {
    const config = getTableConfig(workflowRunTable);
    expect(config.foreignKeys).toHaveLength(4);

    const workflowIdForeignKey = findForeignKeyByLocalColumn(config.foreignKeys, 'workflow_id');
    expect(workflowIdForeignKey.onDelete).toBe('cascade');
    expect(workflowIdForeignKey.reference().foreignTable).toBe(workflowTable);

    const rootRunIdForeignKey = findForeignKeyByLocalColumn(config.foreignKeys, 'root_run_id');
    expect(rootRunIdForeignKey.onDelete).toBe('cascade');
    expect(rootRunIdForeignKey.reference().foreignTable).toBe(workflowRunTable);

    const graphSnapshotHashForeignKey = findForeignKeyByLocalColumn(config.foreignKeys, 'graph_snapshot_hash');
    expect(graphSnapshotHashForeignKey.onDelete).toBe('restrict');
    expect(graphSnapshotHashForeignKey.reference().foreignTable).toBe(graphSnapshotTable);

    const restartedFromRunIdForeignKey = findForeignKeyByLocalColumn(config.foreignKeys, 'restarted_from_run_id');
    expect(restartedFromRunIdForeignKey.onDelete).toBe('set null');
    expect(restartedFromRunIdForeignKey.reference().foreignTable).toBe(workflowRunTable);
  });

  it('egy workflow sor törlése kaszkádban elviszi a hozzá tartozó workflow_run sorokat', () => {
    const { sqlite, database } = openMigratedDatabase();
    insertWorkflow(database, 'workflow-1');
    const hash = insertGraphSnapshot(database, 'workflow-1');
    insertWorkflowRun(database, { id: 'run-1', workflowId: 'workflow-1', rootRunId: 'run-1', graphSnapshotHash: hash });
    insertWorkflowRun(database, { id: 'run-2', workflowId: 'workflow-1', rootRunId: 'run-2', graphSnapshotHash: hash });

    database.delete(workflowTable).where(eq(workflowTable.id, 'workflow-1')).run();

    const rows = database.select().from(workflowRunTable).all();
    expect(rows).toStrictEqual([]);

    sqlite.close();
  });

  it('egy gyökér workflow_run sor törlése kaszkádban elviszi a root_run_id-vel rá mutató al-workflow futásokat', () => {
    const { sqlite, database } = openMigratedDatabase();
    insertWorkflow(database, 'workflow-root');
    insertWorkflow(database, 'workflow-sub');
    const hash = insertGraphSnapshot(database, 'workflow-root');
    insertWorkflowRun(database, {
      id: 'run-root',
      workflowId: 'workflow-root',
      rootRunId: 'run-root',
      graphSnapshotHash: hash,
    });
    // Az al-workflow futás jogosan tartozhat egy másik workflow-hoz (F-11).
    insertWorkflowRun(database, {
      id: 'run-sub',
      workflowId: 'workflow-sub',
      rootRunId: 'run-root',
      graphSnapshotHash: hash,
    });

    database.delete(workflowRunTable).where(eq(workflowRunTable.id, 'run-root')).run();

    const rows = database.select().from(workflowRunTable).all();
    expect(rows).toStrictEqual([]);

    sqlite.close();
  });

  it('egy restarted_from_run_id-vel hivatkozott sor törlése a hivatkozó sor mezőjét NULL-ra állítja, nem törli a sort', () => {
    const { sqlite, database } = openMigratedDatabase();
    insertWorkflow(database, 'workflow-1');
    const hash = insertGraphSnapshot(database, 'workflow-1');
    insertWorkflowRun(database, {
      id: 'run-original',
      workflowId: 'workflow-1',
      rootRunId: 'run-original',
      graphSnapshotHash: hash,
    });
    insertWorkflowRun(database, {
      id: 'run-restarted',
      workflowId: 'workflow-1',
      rootRunId: 'run-restarted',
      graphSnapshotHash: hash,
      restartedFromRunId: 'run-original',
    });

    database.delete(workflowRunTable).where(eq(workflowRunTable.id, 'run-original')).run();

    const row = database.select().from(workflowRunTable).where(eq(workflowRunTable.id, 'run-restarted')).get();
    expect(row).toBeDefined();
    expect(row?.restartedFromRunId).toBeNull();

    sqlite.close();
  });

  it('egy még hivatkozott graph_snapshot sor törlési kísérlete ON DELETE RESTRICT miatt hibázik', () => {
    const { sqlite, database } = openMigratedDatabase();
    insertWorkflow(database, 'workflow-1');
    const hash = insertGraphSnapshot(database, 'workflow-1');
    insertWorkflowRun(database, { id: 'run-1', workflowId: 'workflow-1', rootRunId: 'run-1', graphSnapshotHash: hash });

    let caughtError: unknown;
    try {
      database.delete(graphSnapshotTable).where(eq(graphSnapshotTable.hash, hash)).run();
    } catch (error) {
      caughtError = error;
    }

    if (!(caughtError instanceof SqliteDatabase.SqliteError)) {
      throw new TypeError('váratlan hiba típus: SqliteError-t vártunk a törlési kísérlettől');
    }
    // A SQLite hivatalos doksija szerint (https://www.sqlite.org/foreignkeys.html,
    // 6. szekció, 3. pont) "foreign key actions are considered trigger programs",
    // ezért a RESTRICT akció kiterjesztett hibakódja SQLITE_CONSTRAINT_TRIGGER, nem
    // SQLITE_CONSTRAINT_FOREIGNKEY; ezt ez a teszt valós SQLite ellen igazolja.
    expect(caughtError.code).toBe('SQLITE_CONSTRAINT_TRIGGER');

    const row = database.select().from(graphSnapshotTable).where(eq(graphSnapshotTable.hash, hash)).get();
    expect(row).toBeDefined();

    sqlite.close();
  });
});
