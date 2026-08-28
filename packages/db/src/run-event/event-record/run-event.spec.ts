/* eslint-disable unicorn/no-null -- a `run_event` nullázható SDK oszlopai (sdk_message_subtype, ...) tárolt/visszaadott `null` értéket hordoznak, nem helyőrző `undefined`-et */
import SqliteDatabase from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { asc, eq } from 'drizzle-orm';
import { getTableConfig, type ForeignKey } from 'drizzle-orm/sqlite-core';
import { describe, expect, it } from 'vitest';
import { migrateDatabase } from '../../migration/migrate-database.ts';
import { MIGRATIONS_FOLDER } from '../../migration/migrations-folder.ts';
import { computeSnapshotHash } from '../../graph-snapshot/snapshot-hash/compute-snapshot-hash.ts';
import { graphSnapshotTable } from '../../graph-snapshot/stored-snapshot/graph-snapshot.ts';
import { workflowTable } from '../../workflow-graph/workflow.ts';
import { workflowRunTable } from '../../workflow-run/workflow-run.ts';
import { stepRunTable } from '../../step-run/step-run.ts';
import { runEventTable } from './run-event.ts';

/**
 * Az `openDatabase`/`DatabaseContext` felület nem exportálja a nyers
 * `better-sqlite3` handle-t, és a `RunEventRepository` még nem létezik
 * (T-003-21), ezért a teszt saját `better-sqlite3` + `drizzle()` példányt
 * nyit, és a commitolt migrációkat a `migrateDatabase` segéddel futtatja le
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

function insertWorkflowRun(
  database: BetterSQLite3Database,
  seed: { id: string; workflowId: string; graphSnapshotHash: string },
): void {
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

function insertStepRun(database: BetterSQLite3Database, seed: { id: string; runId: string }): void {
  database
    .insert(stepRunTable)
    .values({
      id: seed.id,
      runId: seed.runId,
      nodeId: 'node-agent',
      nodeType: 'agent_step',
      status: 'pending',
      providerId: 'minimax',
      createdAtMs: new Date(0),
    })
    .run();
}

/**
 * Egy teljes futáshoz tartozó előfeltétel: workflow, pillanatkép, futás.
 */
function seedRun(database: BetterSQLite3Database, workflowId: string, runId: string): void {
  insertWorkflow(database, workflowId);
  const hash = insertGraphSnapshot(database, workflowId);
  insertWorkflowRun(database, { id: runId, workflowId, graphSnapshotHash: hash });
}

/**
 * A `runEventTable` séma valós SQLite ellen: a commitolt migráció tényleg
 * létrehozza a táblát a SPEC-003 6.2 szekció szerinti oszlopokkal, az `id`
 * `INTEGER PRIMARY KEY AUTOINCREMENT` (F-9, F-13, 9. kritérium), a két
 * idegen kulcs és a három index a spec szerinti, és a 4.15 szekció kaszkád
 * lánca (a `run_event` szegmense) futtatott teszttel igazolt.
 */
describe('runEventTable', () => {
  it('ki-be írja a kötelező és az opcionális oszlopokat egyaránt', () => {
    const { sqlite, database } = openMigratedDatabase();
    seedRun(database, 'workflow-1', 'run-1');
    insertStepRun(database, { id: 'step-1', runId: 'run-1' });

    database
      .insert(runEventTable)
      .values({
        runId: 'run-1',
        stepRunId: 'step-1',
        origin: 'sdk',
        kind: 'sdk_assistant',
        occurredAtMs: new Date(1000),
        sdkMessageType: 'assistant',
        sdkMessageSubtype: null,
        sdkSessionId: 'sdk-session-1',
        sdkUuid: 'uuid-1',
        parentToolUseId: 'tool-use-parent',
        toolName: 'web_search',
        toolUseId: 'tool-use-1',
        inputTokens: 100,
        outputTokens: 50,
        cacheReadInputTokens: 10,
        cacheCreationInputTokens: 5,
        numTurns: 2,
        payload: { type: 'assistant', message: { content: [] } },
      })
      .run();

    const row = database.select().from(runEventTable).where(eq(runEventTable.sdkUuid, 'uuid-1')).get();
    expect(row).toStrictEqual({
      id: 1,
      runId: 'run-1',
      stepRunId: 'step-1',
      origin: 'sdk',
      kind: 'sdk_assistant',
      occurredAtMs: new Date(1000),
      sdkMessageType: 'assistant',
      sdkMessageSubtype: null,
      sdkSessionId: 'sdk-session-1',
      sdkUuid: 'uuid-1',
      parentToolUseId: 'tool-use-parent',
      toolName: 'web_search',
      toolUseId: 'tool-use-1',
      inputTokens: 100,
      outputTokens: 50,
      cacheReadInputTokens: 10,
      cacheCreationInputTokens: 5,
      numTurns: 2,
      payload: { type: 'assistant', message: { content: [] } },
    });

    sqlite.close();
  });

  it('a nullable oszlopok NULL maradnak, a step_run_id opcionális futás szintű eseménynél', () => {
    const { sqlite, database } = openMigratedDatabase();
    seedRun(database, 'workflow-1', 'run-1');

    database
      .insert(runEventTable)
      .values({
        runId: 'run-1',
        origin: 'engine',
        kind: 'run_started',
        occurredAtMs: new Date(0),
        payload: { runId: 'run-1' },
      })
      .run();

    const row = database.select().from(runEventTable).where(eq(runEventTable.runId, 'run-1')).get();
    expect(row?.stepRunId).toBeNull();
    expect(row?.sdkMessageType).toBeNull();
    expect(row?.sdkMessageSubtype).toBeNull();
    expect(row?.sdkSessionId).toBeNull();
    expect(row?.sdkUuid).toBeNull();
    expect(row?.parentToolUseId).toBeNull();
    expect(row?.toolName).toBeNull();
    expect(row?.toolUseId).toBeNull();
    expect(row?.inputTokens).toBeNull();
    expect(row?.outputTokens).toBeNull();
    expect(row?.cacheReadInputTokens).toBeNull();
    expect(row?.cacheCreationInputTokens).toBeNull();
    expect(row?.numTurns).toBeNull();

    sqlite.close();
  });

  it('a három indexet a spec szerinti néven, oszlopon és egyediségen definiálja', () => {
    const config = getTableConfig(runEventTable);
    expect(config.indexes.map((index) => index.config.name)).toStrictEqual([
      'run_event_run_id_idx',
      'run_event_step_run_id_idx',
      'run_event_run_uuid_uq',
    ]);

    function columnNames(index: (typeof config.indexes)[number] | undefined): readonly string[] {
      return (index?.config.columns ?? []).map((column) => {
        if (typeof column === 'string' || !('name' in column)) {
          throw new TypeError('váratlan index oszlop típus');
        }
        return column.name;
      });
    }

    const [runIdIndex, stepRunIdIndex, uuidIndex] = config.indexes;
    expect(columnNames(runIdIndex)).toStrictEqual(['run_id', 'id']);
    expect(runIdIndex?.config.unique).toBe(false);
    expect(columnNames(stepRunIdIndex)).toStrictEqual(['step_run_id', 'id']);
    expect(stepRunIdIndex?.config.unique).toBe(false);
    expect(columnNames(uuidIndex)).toStrictEqual(['run_id', 'sdk_uuid']);
    expect(uuidIndex?.config.unique).toBe(true);
  });

  it('pontosan két idegen kulcsa van, a helyes cél táblára és ON DELETE viselkedésre mutatva', () => {
    const config = getTableConfig(runEventTable);
    expect(config.foreignKeys).toHaveLength(2);

    const runIdForeignKey = requireForeignKeyByLocalColumn(config.foreignKeys, 'run_id');
    expect(runIdForeignKey.onDelete).toBe('cascade');
    expect(runIdForeignKey.reference().foreignTable).toBe(workflowRunTable);

    const stepRunIdForeignKey = requireForeignKeyByLocalColumn(config.foreignKeys, 'step_run_id');
    expect(stepRunIdForeignKey.onDelete).toBe('cascade');
    expect(stepRunIdForeignKey.reference().foreignTable).toBe(stepRunTable);
  });

  describe('AUTOINCREMENT (F-9, F-13, 9. kritérium)', () => {
    it('a sqlite_sequence tábla létezik a migrált adatbázisban', () => {
      const { sqlite, database } = openMigratedDatabase();
      seedRun(database, 'workflow-1', 'run-1');
      database
        .insert(runEventTable)
        .values({ runId: 'run-1', origin: 'engine', kind: 'run_started', occurredAtMs: new Date(0), payload: {} })
        .run();

      const row = sqlite
        .prepare<[], { name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name='sqlite_sequence'")
        .get();
      expect(row).toStrictEqual({ name: 'sqlite_sequence' });

      sqlite.close();
    });

    it('a legnagyobb azonosítójú sor törlése után a következő beszúrás nem használja újra az azonosítót', () => {
      const { sqlite, database } = openMigratedDatabase();
      seedRun(database, 'workflow-1', 'run-1');

      database
        .insert(runEventTable)
        .values([
          { runId: 'run-1', origin: 'engine', kind: 'run_started', occurredAtMs: new Date(0), payload: { seq: 1 } },
          { runId: 'run-1', origin: 'engine', kind: 'step_started', occurredAtMs: new Date(1), payload: { seq: 2 } },
          { runId: 'run-1', origin: 'engine', kind: 'step_finished', occurredAtMs: new Date(2), payload: { seq: 3 } },
        ])
        .run();

      const insertedRows = database.select().from(runEventTable).orderBy(asc(runEventTable.id)).all();
      expect(insertedRows).toHaveLength(3);
      const ids = insertedRows.map((row) => row.id);
      const maxId = Math.max(...ids);

      // A legnagyobb azonosítójú sor törlése: a sima INTEGER PRIMARY KEY
      // (rowid alias) itt újrahasznosítaná a törölt rowid-t, az
      // AUTOINCREMENT viszont nem (F-9).
      database.delete(runEventTable).where(eq(runEventTable.id, maxId)).run();

      database
        .insert(runEventTable)
        .values({
          runId: 'run-1',
          origin: 'engine',
          kind: 'run_finished',
          occurredAtMs: new Date(3),
          payload: { seq: 4 },
        })
        .run();

      const newRow = database.select().from(runEventTable).where(eq(runEventTable.kind, 'run_finished')).get();
      expect(newRow).toBeDefined();
      const newId = newRow?.id ?? -1;
      expect(newId).toBeGreaterThan(maxId);
      expect(ids.includes(newId)).toBe(false);

      sqlite.close();
    });
  });

  describe('egyedi index NULL viselkedés (F-10)', () => {
    it('két sor ugyanazzal a run_id-vel, mindkettőn NULL sdk_uuid, mindkettő beszúrható', () => {
      const { sqlite, database } = openMigratedDatabase();
      seedRun(database, 'workflow-1', 'run-1');

      database
        .insert(runEventTable)
        .values({ runId: 'run-1', origin: 'engine', kind: 'run_started', occurredAtMs: new Date(0), payload: {} })
        .run();
      database
        .insert(runEventTable)
        .values({ runId: 'run-1', origin: 'engine', kind: 'step_started', occurredAtMs: new Date(1), payload: {} })
        .run();

      const rows = database.select().from(runEventTable).where(eq(runEventTable.runId, 'run-1')).all();
      expect(rows).toHaveLength(2);
      expect(rows.every((row) => row.sdkUuid === null)).toBe(true);

      sqlite.close();
    });

    it('két sor ugyanazzal a run_id és ugyanazzal a nem-NULL sdk_uuid a második beszúráson egyediségi hibát ad', () => {
      const { sqlite, database } = openMigratedDatabase();
      seedRun(database, 'workflow-1', 'run-1');

      database
        .insert(runEventTable)
        .values({
          runId: 'run-1',
          origin: 'sdk',
          kind: 'sdk_assistant',
          occurredAtMs: new Date(0),
          sdkUuid: 'uuid-duplikalt',
          payload: {},
        })
        .run();

      let caughtError: unknown;
      try {
        database
          .insert(runEventTable)
          .values({
            runId: 'run-1',
            origin: 'sdk',
            kind: 'sdk_assistant',
            occurredAtMs: new Date(1),
            sdkUuid: 'uuid-duplikalt',
            payload: {},
          })
          .run();
      } catch (error) {
        caughtError = error;
      }

      if (!(caughtError instanceof SqliteDatabase.SqliteError)) {
        throw new TypeError('váratlan hiba típus: SqliteError-t vártunk a duplikált beszúrástól');
      }
      expect(caughtError.code).toBe('SQLITE_CONSTRAINT_UNIQUE');

      const rows = database.select().from(runEventTable).where(eq(runEventTable.sdkUuid, 'uuid-duplikalt')).all();
      expect(rows).toHaveLength(1);

      sqlite.close();
    });

    it('ugyanaz az sdk_uuid két különböző run_id alatt nem ütközik', () => {
      const { sqlite, database } = openMigratedDatabase();
      seedRun(database, 'workflow-1', 'run-1');
      seedRun(database, 'workflow-2', 'run-2');

      database
        .insert(runEventTable)
        .values({
          runId: 'run-1',
          origin: 'sdk',
          kind: 'sdk_assistant',
          occurredAtMs: new Date(0),
          sdkUuid: 'uuid-megosztott',
          payload: {},
        })
        .run();
      database
        .insert(runEventTable)
        .values({
          runId: 'run-2',
          origin: 'sdk',
          kind: 'sdk_assistant',
          occurredAtMs: new Date(0),
          sdkUuid: 'uuid-megosztott',
          payload: {},
        })
        .run();

      const rows = database.select().from(runEventTable).where(eq(runEventTable.sdkUuid, 'uuid-megosztott')).all();
      expect(rows).toHaveLength(2);

      sqlite.close();
    });
  });

  describe('kaszkád (4.15 szekció)', () => {
    it('egy workflow_run sor törlése kaszkádban elviszi a hozzá tartozó run_event sorokat', () => {
      const { sqlite, database } = openMigratedDatabase();
      seedRun(database, 'workflow-1', 'run-1');

      database
        .insert(runEventTable)
        .values([
          { runId: 'run-1', origin: 'engine', kind: 'run_started', occurredAtMs: new Date(0), payload: {} },
          { runId: 'run-1', origin: 'engine', kind: 'run_finished', occurredAtMs: new Date(1), payload: {} },
        ])
        .run();

      database.delete(workflowRunTable).where(eq(workflowRunTable.id, 'run-1')).run();

      const rows = database.select().from(runEventTable).all();
      expect(rows).toStrictEqual([]);

      sqlite.close();
    });

    it('egy step_run sor törlése kaszkádban elviszi a hozzá tartozó run_event sorokat, a futás szintű (NULL step_run_id) sor megmarad', () => {
      const { sqlite, database } = openMigratedDatabase();
      seedRun(database, 'workflow-1', 'run-1');
      insertStepRun(database, { id: 'step-1', runId: 'run-1' });

      database
        .insert(runEventTable)
        .values([
          {
            runId: 'run-1',
            stepRunId: 'step-1',
            origin: 'engine',
            kind: 'step_started',
            occurredAtMs: new Date(0),
            payload: {},
          },
          {
            runId: 'run-1',
            stepRunId: 'step-1',
            origin: 'engine',
            kind: 'step_finished',
            occurredAtMs: new Date(1),
            payload: {},
          },
          // Futás szintű esemény, NULL step_run_id: nem a step_run gyereke,
          // tehát a step_run törlése nem érintheti.
          { runId: 'run-1', origin: 'engine', kind: 'run_started', occurredAtMs: new Date(2), payload: {} },
        ])
        .run();

      database.delete(stepRunTable).where(eq(stepRunTable.id, 'step-1')).run();

      const rows = database.select().from(runEventTable).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.kind).toBe('run_started');
      expect(rows[0]?.stepRunId).toBeNull();

      sqlite.close();
    });
  });
});
