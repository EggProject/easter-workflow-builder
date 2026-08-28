import SqliteDatabase from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { getTableConfig, type ForeignKey } from 'drizzle-orm/sqlite-core';
import { describe, expect, it } from 'vitest';
import { migrateDatabase } from '../migration/migrate-database.ts';
import { MIGRATIONS_FOLDER } from '../migration/migrations-folder.ts';
import { computeSnapshotHash } from '../graph-snapshot/snapshot-hash/compute-snapshot-hash.ts';
import { graphSnapshotTable } from '../graph-snapshot/stored-snapshot/graph-snapshot.ts';
import { workflowTable } from '../workflow-graph/workflow.ts';
import { workflowRunTable } from '../workflow-run/workflow-run.ts';
import { stepRunTable } from '../step-run/step-run.ts';
import { humanApprovalTable } from './human-approval.ts';

/**
 * Az `openDatabase`/`DatabaseContext` felület nem exportálja a nyers
 * `better-sqlite3` handle-t, és a `HumanApprovalRepository` még nem
 * bizonyítja a séma összes garanciáját (a repository a jövőbeli lépésekben
 * bővül), ezért a teszt saját `better-sqlite3` + `drizzle()` példányt nyit,
 * és a commitolt migrációkat a `migrateDatabase` segéddel futtatja le
 * rajta, ugyanúgy, ahogy a `step-run` téma tábla tesztje teszi
 * (`step-run.spec.ts`).
 */
function openMigratedDatabase(): { sqlite: SqliteDatabase.Database; database: BetterSQLite3Database } {
  const sqlite = new SqliteDatabase(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const database = drizzle(sqlite);
  migrateDatabase(database, MIGRATIONS_FOLDER);
  return { sqlite, database };
}

function findForeignKeyByLocalColumn(
  foreignKeys: readonly ForeignKey[],
  localColumnName: string,
): ForeignKey | undefined {
  return foreignKeys.find((foreignKey) => foreignKey.reference().columns[0]?.name === localColumnName);
}

function requireForeignKeyByLocalColumn(foreignKeys: readonly ForeignKey[], localColumnName: string): ForeignKey {
  const found = findForeignKeyByLocalColumn(foreignKeys, localColumnName);
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
  graphSnapshotHash: string;
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
      rootRunId: seed.id,
      depth: 0,
      workflowAncestry: [seed.workflowId],
      graphSnapshotHash: seed.graphSnapshotHash,
      persistedStreamDeltas: false,
      createdAtMs: new Date(0),
    })
    .run();
}

function insertStepRun(database: BetterSQLite3Database, id: string, runId: string): void {
  database
    .insert(stepRunTable)
    .values({
      id,
      runId,
      nodeId: 'node-approval',
      nodeType: 'human_approval',
      status: 'running',
      providerId: 'minimax',
      createdAtMs: new Date(0),
    })
    .run();
}

/**
 * A `humanApprovalTable` séma valós SQLite ellen: a commitolt migráció
 * tényleg létrehozza a táblát a SPEC-003 4.12 szekció szerinti oszlopokkal,
 * mindkét idegen kulcs a helyes cél táblára és `ON DELETE CASCADE`
 * viselkedésre mutat, a `step_run_id` egyedi, és a 4.15 szekció kaszkád
 * lánca (a `human_approval` szegmense) futtatott teszttel igazolt.
 */
describe('humanApprovalTable', () => {
  it('ki-be írja a kötelező és az opcionális oszlopokat egyaránt', () => {
    const { sqlite, database } = openMigratedDatabase();
    insertWorkflow(database, 'workflow-1');
    const hash = insertGraphSnapshot(database, 'workflow-1');
    insertWorkflowRun(database, { id: 'run-1', workflowId: 'workflow-1', graphSnapshotHash: hash });
    insertStepRun(database, 'step-1', 'run-1');

    database
      .insert(humanApprovalTable)
      .values({
        id: 'approval-1',
        runId: 'run-1',
        stepRunId: 'step-1',
        title: 'Jóváhagyás szükséges',
        body: 'A lépés a folytatáshoz emberi jóváhagyást igényel.',
        payload: { previousStepOutput: { ok: true } },
        decision: 'approved',
        requestedAtMs: new Date(1000),
        decidedAtMs: new Date(2000),
      })
      .run();

    const row = database.select().from(humanApprovalTable).where(eq(humanApprovalTable.id, 'approval-1')).get();
    expect(row).toStrictEqual({
      id: 'approval-1',
      runId: 'run-1',
      stepRunId: 'step-1',
      title: 'Jóváhagyás szükséges',
      body: 'A lépés a folytatáshoz emberi jóváhagyást igényel.',
      payload: { previousStepOutput: { ok: true } },
      decision: 'approved',
      requestedAtMs: new Date(1000),
      decidedAtMs: new Date(2000),
    });

    sqlite.close();
  });

  it('a decision és a decided_at_ms NULL marad, amíg nincs döntés', () => {
    const { sqlite, database } = openMigratedDatabase();
    insertWorkflow(database, 'workflow-1');
    const hash = insertGraphSnapshot(database, 'workflow-1');
    insertWorkflowRun(database, { id: 'run-1', workflowId: 'workflow-1', graphSnapshotHash: hash });
    insertStepRun(database, 'step-1', 'run-1');

    database
      .insert(humanApprovalTable)
      .values({
        id: 'approval-1',
        runId: 'run-1',
        stepRunId: 'step-1',
        title: 'Jóváhagyás szükséges',
        body: 'A lépés a folytatáshoz emberi jóváhagyást igényel.',
        payload: {},
        requestedAtMs: new Date(1000),
      })
      .run();

    const row = database.select().from(humanApprovalTable).where(eq(humanApprovalTable.id, 'approval-1')).get();
    expect(row?.decision).toBeNull();
    expect(row?.decidedAtMs).toBeNull();

    sqlite.close();
  });

  it('a két indexet a spec szerinti néven és oszlopon definiálja', () => {
    const config = getTableConfig(humanApprovalTable);
    expect(config.indexes.map((index) => index.config.name)).toStrictEqual([
      'human_approval_step_uq',
      'human_approval_pending_idx',
    ]);

    function columnNames(index: (typeof config.indexes)[number] | undefined): readonly string[] {
      return (index?.config.columns ?? []).map((column) => {
        if (typeof column === 'string' || !('name' in column)) {
          throw new TypeError('váratlan index oszlop típus');
        }
        return column.name;
      });
    }

    const [stepUqIndex, pendingIndex] = config.indexes;
    expect(stepUqIndex?.config.unique).toBe(true);
    expect(columnNames(stepUqIndex)).toStrictEqual(['step_run_id']);
    expect(pendingIndex?.config.unique).toBeFalsy();
    expect(columnNames(pendingIndex)).toStrictEqual(['decision', 'requested_at_ms']);
  });

  it('pontosan két idegen kulcsa van, mindkettő ON DELETE CASCADE', () => {
    const config = getTableConfig(humanApprovalTable);
    expect(config.foreignKeys).toHaveLength(2);

    const runIdForeignKey = requireForeignKeyByLocalColumn(config.foreignKeys, 'run_id');
    expect(runIdForeignKey.onDelete).toBe('cascade');
    expect(runIdForeignKey.reference().foreignTable).toBe(workflowRunTable);

    const stepRunIdForeignKey = requireForeignKeyByLocalColumn(config.foreignKeys, 'step_run_id');
    expect(stepRunIdForeignKey.onDelete).toBe('cascade');
    expect(stepRunIdForeignKey.reference().foreignTable).toBe(stepRunTable);
  });

  it('két sor ugyanazzal a step_run_id-vel a human_approval_step_uq egyedi index miatt hibázik', () => {
    const { sqlite, database } = openMigratedDatabase();
    insertWorkflow(database, 'workflow-1');
    const hash = insertGraphSnapshot(database, 'workflow-1');
    insertWorkflowRun(database, { id: 'run-1', workflowId: 'workflow-1', graphSnapshotHash: hash });
    insertStepRun(database, 'step-1', 'run-1');

    database
      .insert(humanApprovalTable)
      .values({
        id: 'approval-1',
        runId: 'run-1',
        stepRunId: 'step-1',
        title: 'Első kérés',
        body: 'Első jóváhagyási kérés.',
        payload: {},
        requestedAtMs: new Date(1000),
      })
      .run();

    expect(() => {
      database
        .insert(humanApprovalTable)
        .values({
          id: 'approval-2',
          runId: 'run-1',
          stepRunId: 'step-1',
          title: 'Második kérés',
          body: 'Ugyanahhoz a lépéshez tartozó második kérés.',
          payload: {},
          requestedAtMs: new Date(2000),
        })
        .run();
    }).toThrow(/UNIQUE constraint failed/);

    sqlite.close();
  });

  it('egy workflow_run sor törlése kaszkádban elviszi a hozzá tartozó human_approval sorokat', () => {
    const { sqlite, database } = openMigratedDatabase();
    insertWorkflow(database, 'workflow-1');
    const hash = insertGraphSnapshot(database, 'workflow-1');
    insertWorkflowRun(database, { id: 'run-1', workflowId: 'workflow-1', graphSnapshotHash: hash });
    insertStepRun(database, 'step-1', 'run-1');
    database
      .insert(humanApprovalTable)
      .values({
        id: 'approval-1',
        runId: 'run-1',
        stepRunId: 'step-1',
        title: 'Jóváhagyás',
        body: 'Jóváhagyási kérés.',
        payload: {},
        requestedAtMs: new Date(1000),
      })
      .run();

    database.delete(workflowRunTable).where(eq(workflowRunTable.id, 'run-1')).run();

    const rows = database.select().from(humanApprovalTable).all();
    expect(rows).toStrictEqual([]);

    sqlite.close();
  });

  it('egy step_run sor törlése kaszkádban elviszi a hozzá tartozó human_approval sort', () => {
    const { sqlite, database } = openMigratedDatabase();
    insertWorkflow(database, 'workflow-1');
    const hash = insertGraphSnapshot(database, 'workflow-1');
    insertWorkflowRun(database, { id: 'run-1', workflowId: 'workflow-1', graphSnapshotHash: hash });
    insertStepRun(database, 'step-1', 'run-1');
    database
      .insert(humanApprovalTable)
      .values({
        id: 'approval-1',
        runId: 'run-1',
        stepRunId: 'step-1',
        title: 'Jóváhagyás',
        body: 'Jóváhagyási kérés.',
        payload: {},
        requestedAtMs: new Date(1000),
      })
      .run();

    database.delete(stepRunTable).where(eq(stepRunTable.id, 'step-1')).run();

    const rows = database.select().from(humanApprovalTable).all();
    expect(rows).toStrictEqual([]);

    sqlite.close();
  });
});
