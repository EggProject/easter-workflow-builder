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
import { workflowRunTable } from '../workflow-run/workflow-run.ts';
import { stepRunTable } from './step-run.ts';

/**
 * Az `openDatabase`/`DatabaseContext` felület nem exportálja a nyers
 * `better-sqlite3` handle-t, és a `StepRunRepository` még nem létezik
 * (T-003-18), ezért a teszt saját `better-sqlite3` + `drizzle()` példányt
 * nyit, és a commitolt migrációkat a `migrateDatabase` segéddel futtatja le
 * rajta, ugyanúgy, ahogy a `workflow-run` téma tábla tesztje teszi
 * (`workflow-run.spec.ts`).
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

/**
 * A `stepRunTable` séma valós SQLite ellen: a commitolt migráció tényleg
 * létrehozza a táblát a SPEC-003 4.10 szekció szerinti oszlopokkal, a
 * `node_id` nem idegen kulcs (21. kritérium), a három idegen kulcs a helyes
 * cél táblára és `ON DELETE` viselkedésre mutat, és a 4.15 szekció kaszkád
 * lánca (a `step_run` szegmense, a végrehajtási fa és az al-workflow SET
 * NULL esete) futtatott teszttel igazolt.
 */
describe('stepRunTable', () => {
  it('ki-be írja a kötelező és az opcionális oszlopokat egyaránt', () => {
    const { sqlite, database } = openMigratedDatabase();
    insertWorkflow(database, 'workflow-1');
    const hash = insertGraphSnapshot(database, 'workflow-1');
    insertWorkflowRun(database, { id: 'run-1', workflowId: 'workflow-1', graphSnapshotHash: hash });
    insertWorkflowRun(database, { id: 'run-sub', workflowId: 'workflow-1', graphSnapshotHash: hash });

    database
      .insert(stepRunTable)
      .values({
        id: 'step-parent',
        runId: 'run-1',
        nodeId: 'node-agent',
        nodeType: 'agent_step',
        iteration: 0,
        attempt: 1,
        status: 'pending',
        providerId: 'minimax',
        createdAtMs: new Date(0),
      })
      .run();

    database
      .insert(stepRunTable)
      .values({
        id: 'step-child',
        runId: 'run-1',
        nodeId: 'node-sub-workflow',
        nodeType: 'sub_workflow',
        parentStepRunId: 'step-parent',
        iteration: 2,
        attempt: 3,
        status: 'succeeded',
        providerId: 'claude-subscription',
        modelId: 'claude-opus-4',
        sessionMode: 'continued',
        sdkSessionId: 'sdk-session-1',
        resumedFromSessionId: 'sdk-session-0',
        forkedSession: true,
        structuredOutputStrategy: 'json_schema',
        output: { ok: true },
        resultSubtype: 'success',
        numTurns: 4,
        inputTokens: 100,
        outputTokens: 50,
        cacheReadInputTokens: 10,
        cacheCreationInputTokens: 5,
        subWorkflowRunId: 'run-sub',
        errorKind: 'timeout',
        errorMessage: 'A lépés túllépte az időkeretet.',
        startedAtMs: new Date(1000),
        finishedAtMs: new Date(2000),
        createdAtMs: new Date(500),
      })
      .run();

    const row = database.select().from(stepRunTable).where(eq(stepRunTable.id, 'step-child')).get();
    expect(row).toStrictEqual({
      id: 'step-child',
      runId: 'run-1',
      nodeId: 'node-sub-workflow',
      nodeType: 'sub_workflow',
      parentStepRunId: 'step-parent',
      iteration: 2,
      attempt: 3,
      status: 'succeeded',
      providerId: 'claude-subscription',
      modelId: 'claude-opus-4',
      sessionMode: 'continued',
      sdkSessionId: 'sdk-session-1',
      resumedFromSessionId: 'sdk-session-0',
      forkedSession: true,
      structuredOutputStrategy: 'json_schema',
      output: { ok: true },
      resultSubtype: 'success',
      numTurns: 4,
      inputTokens: 100,
      outputTokens: 50,
      cacheReadInputTokens: 10,
      cacheCreationInputTokens: 5,
      subWorkflowRunId: 'run-sub',
      errorKind: 'timeout',
      errorMessage: 'A lépés túllépte az időkeretet.',
      startedAtMs: new Date(1000),
      finishedAtMs: new Date(2000),
      createdAtMs: new Date(500),
    });

    sqlite.close();
  });

  it('a nullable oszlopok NULL maradnak, és a séma szintű alapértékek élnek', () => {
    const { sqlite, database } = openMigratedDatabase();
    insertWorkflow(database, 'workflow-1');
    const hash = insertGraphSnapshot(database, 'workflow-1');
    insertWorkflowRun(database, { id: 'run-1', workflowId: 'workflow-1', graphSnapshotHash: hash });

    // Az `iteration`, `attempt` és `forked_session` mező szándékosan hiányzik
    // a beszúrásból, hogy a séma szintű `.default()` alapértékét mérje
    // (SPEC-003 4.10 szekció "alapból" megjegyzései, 41. kritérium).
    database
      .insert(stepRunTable)
      .values({
        id: 'step-1',
        runId: 'run-1',
        nodeId: 'node-agent',
        nodeType: 'agent_step',
        status: 'pending',
        providerId: 'minimax',
        createdAtMs: new Date(0),
      })
      .run();

    const row = database.select().from(stepRunTable).where(eq(stepRunTable.id, 'step-1')).get();
    expect(row?.iteration).toBe(0);
    expect(row?.attempt).toBe(1);
    expect(row?.forkedSession).toBe(false);
    expect(row?.parentStepRunId).toBeNull();
    expect(row?.modelId).toBeNull();
    expect(row?.sessionMode).toBeNull();
    expect(row?.sdkSessionId).toBeNull();
    expect(row?.resumedFromSessionId).toBeNull();
    expect(row?.structuredOutputStrategy).toBeNull();
    expect(row?.output).toBeNull();
    expect(row?.resultSubtype).toBeNull();
    expect(row?.numTurns).toBeNull();
    expect(row?.inputTokens).toBeNull();
    expect(row?.outputTokens).toBeNull();
    expect(row?.cacheReadInputTokens).toBeNull();
    expect(row?.cacheCreationInputTokens).toBeNull();
    expect(row?.subWorkflowRunId).toBeNull();
    expect(row?.errorKind).toBeNull();
    expect(row?.errorMessage).toBeNull();
    expect(row?.startedAtMs).toBeNull();
    expect(row?.finishedAtMs).toBeNull();

    sqlite.close();
  });

  it('a négy indexet a spec szerinti néven és oszlopon definiálja', () => {
    const config = getTableConfig(stepRunTable);
    expect(config.indexes.map((index) => index.config.name)).toStrictEqual([
      'step_run_run_created_idx',
      'step_run_run_node_idx',
      'step_run_parent_idx',
      'step_run_sub_run_idx',
    ]);

    const [runCreatedIndex, runNodeIndex] = config.indexes;
    function columnNames(index: (typeof config.indexes)[number] | undefined): readonly string[] {
      return (index?.config.columns ?? []).map((column) => {
        if (typeof column === 'string' || !('name' in column)) {
          throw new TypeError('váratlan index oszlop típus');
        }
        return column.name;
      });
    }
    expect(columnNames(runCreatedIndex)).toStrictEqual(['run_id', 'created_at_ms']);
    expect(columnNames(runNodeIndex)).toStrictEqual(['run_id', 'node_id']);
  });

  it('pontosan három idegen kulcsa van, a node_id nem szerepel köztük', () => {
    const config = getTableConfig(stepRunTable);
    expect(config.foreignKeys).toHaveLength(3);
    expect(findForeignKeyByLocalColumn(config.foreignKeys, 'node_id')).toBeUndefined();

    const runIdForeignKey = requireForeignKeyByLocalColumn(config.foreignKeys, 'run_id');
    expect(runIdForeignKey.onDelete).toBe('cascade');
    expect(runIdForeignKey.reference().foreignTable).toBe(workflowRunTable);

    const parentStepRunIdForeignKey = requireForeignKeyByLocalColumn(config.foreignKeys, 'parent_step_run_id');
    expect(parentStepRunIdForeignKey.onDelete).toBe('cascade');
    expect(parentStepRunIdForeignKey.reference().foreignTable).toBe(stepRunTable);

    const subWorkflowRunIdForeignKey = requireForeignKeyByLocalColumn(config.foreignKeys, 'sub_workflow_run_id');
    expect(subWorkflowRunIdForeignKey.onDelete).toBe('set null');
    expect(subWorkflowRunIdForeignKey.reference().foreignTable).toBe(workflowRunTable);
  });

  it('egy step_run sor beszúrható olyan node_id-vel, ami nem létezik a workflow_node táblában', () => {
    const { sqlite, database } = openMigratedDatabase();
    insertWorkflow(database, 'workflow-1');
    const hash = insertGraphSnapshot(database, 'workflow-1');
    insertWorkflowRun(database, { id: 'run-1', workflowId: 'workflow-1', graphSnapshotHash: hash });

    // A workflow_node tábla teljesen üres, mégis sikeres a beszúrás: a
    // node_id nem idegen kulcs (SPEC-003 4.10 szekció, 21. kritérium).
    database
      .insert(stepRunTable)
      .values({
        id: 'step-1',
        runId: 'run-1',
        nodeId: 'node-nem-letezik',
        nodeType: 'agent_step',
        status: 'pending',
        providerId: 'minimax',
        createdAtMs: new Date(0),
      })
      .run();

    const row = database.select().from(stepRunTable).where(eq(stepRunTable.id, 'step-1')).get();
    expect(row?.nodeId).toBe('node-nem-letezik');

    sqlite.close();
  });

  it('egy workflow_run sor törlése kaszkádban elviszi a hozzá tartozó step_run sorokat', () => {
    const { sqlite, database } = openMigratedDatabase();
    insertWorkflow(database, 'workflow-1');
    const hash = insertGraphSnapshot(database, 'workflow-1');
    insertWorkflowRun(database, { id: 'run-1', workflowId: 'workflow-1', graphSnapshotHash: hash });

    database
      .insert(stepRunTable)
      .values([
        {
          id: 'step-1',
          runId: 'run-1',
          nodeId: 'node-a',
          nodeType: 'agent_step',
          status: 'pending',
          providerId: 'minimax',
          createdAtMs: new Date(0),
        },
        {
          id: 'step-2',
          runId: 'run-1',
          nodeId: 'node-b',
          nodeType: 'agent_step',
          status: 'pending',
          providerId: 'minimax',
          createdAtMs: new Date(0),
        },
      ])
      .run();

    database.delete(workflowRunTable).where(eq(workflowRunTable.id, 'run-1')).run();

    const rows = database.select().from(stepRunTable).all();
    expect(rows).toStrictEqual([]);

    sqlite.close();
  });

  it('egy szülő step_run sor törlése kaszkádban elviszi a parent_step_run_id-vel rá mutató végrehajtási fát', () => {
    const { sqlite, database } = openMigratedDatabase();
    insertWorkflow(database, 'workflow-1');
    const hash = insertGraphSnapshot(database, 'workflow-1');
    insertWorkflowRun(database, { id: 'run-1', workflowId: 'workflow-1', graphSnapshotHash: hash });

    database
      .insert(stepRunTable)
      .values({
        id: 'step-root',
        runId: 'run-1',
        nodeId: 'node-fan-out',
        nodeType: 'fan_out',
        status: 'running',
        providerId: 'minimax',
        createdAtMs: new Date(0),
      })
      .run();
    database
      .insert(stepRunTable)
      .values({
        id: 'step-branch',
        runId: 'run-1',
        nodeId: 'node-agent',
        nodeType: 'agent_step',
        parentStepRunId: 'step-root',
        status: 'running',
        providerId: 'minimax',
        createdAtMs: new Date(0),
      })
      .run();
    // Két szint mély fa: a `step-branch` a `step-root` gyereke, a
    // `step-leaf` a `step-branch` gyereke. A `step-root` törlésének mindkét
    // szintet el kell vinnie a láncolt `ON DELETE CASCADE` miatt (F-11).
    database
      .insert(stepRunTable)
      .values({
        id: 'step-leaf',
        runId: 'run-1',
        nodeId: 'node-agent-2',
        nodeType: 'agent_step',
        parentStepRunId: 'step-branch',
        status: 'running',
        providerId: 'minimax',
        createdAtMs: new Date(0),
      })
      .run();

    database.delete(stepRunTable).where(eq(stepRunTable.id, 'step-root')).run();

    const rows = database.select().from(stepRunTable).all();
    expect(rows).toStrictEqual([]);

    sqlite.close();
  });

  it('egy sub_workflow_run_id-vel hivatkozott workflow_run sor törlése a mezőt NULL-ra állítja, nem törli a sort', () => {
    const { sqlite, database } = openMigratedDatabase();
    insertWorkflow(database, 'workflow-1');
    const hash = insertGraphSnapshot(database, 'workflow-1');
    insertWorkflowRun(database, { id: 'run-1', workflowId: 'workflow-1', graphSnapshotHash: hash });
    insertWorkflowRun(database, { id: 'run-sub', workflowId: 'workflow-1', graphSnapshotHash: hash });

    database
      .insert(stepRunTable)
      .values({
        id: 'step-caller',
        runId: 'run-1',
        nodeId: 'node-sub-workflow',
        nodeType: 'sub_workflow',
        status: 'running',
        providerId: 'minimax',
        subWorkflowRunId: 'run-sub',
        createdAtMs: new Date(0),
      })
      .run();

    database.delete(workflowRunTable).where(eq(workflowRunTable.id, 'run-sub')).run();

    const row = database.select().from(stepRunTable).where(eq(stepRunTable.id, 'step-caller')).get();
    expect(row).toBeDefined();
    expect(row?.subWorkflowRunId).toBeNull();

    sqlite.close();
  });
});
