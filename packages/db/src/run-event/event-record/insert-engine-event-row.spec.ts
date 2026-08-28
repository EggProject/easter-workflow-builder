/* eslint-disable unicorn/no-null -- a `run_event` opcionális oszlopai (`step_run_id`, ...) valódi NULL értéket hordoznak, nem helyőrző `undefined`-et */
import SqliteDatabase from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { isOkOutcome } from '@easter-workflow-builder/core';
import { migrateDatabase } from '../../migration/migrate-database.ts';
import { MIGRATIONS_FOLDER } from '../../migration/migrations-folder.ts';
import { workflowTable } from '../../workflow-graph/workflow.ts';
import { graphSnapshotTable } from '../../graph-snapshot/stored-snapshot/graph-snapshot.ts';
import { computeSnapshotHash } from '../../graph-snapshot/snapshot-hash/compute-snapshot-hash.ts';
import { workflowRunTable } from '../../workflow-run/workflow-run.ts';
import { stepRunTable } from '../../step-run/step-run.ts';
import { runEventTable } from './run-event.ts';
import { insertEngineEventRow } from './insert-engine-event-row.ts';

/**
 * Az `insertEngineEventRow` PLAIN, tranzakció nélküli segédfüggvény (lásd a
 * fájl dokumentációját), ezért ez a teszt saját `better-sqlite3` + `drizzle()`
 * példányt nyit, ugyanúgy, ahogy a `run-event.spec.ts` teszi.
 */
function openMigratedDatabase(): { sqlite: SqliteDatabase.Database; database: BetterSQLite3Database } {
  const sqlite = new SqliteDatabase(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const database = drizzle(sqlite);
  migrateDatabase(database, MIGRATIONS_FOLDER);
  return { sqlite, database };
}

function seedRun(database: BetterSQLite3Database, workflowId: string, runId: string): void {
  database
    .insert(workflowTable)
    .values({ id: workflowId, name: workflowId, createdAtMs: new Date(0), updatedAtMs: new Date(0) })
    .run();
  const document = { version: 1, workflow: { id: workflowId } };
  const hash = computeSnapshotHash(JSON.stringify(document));
  database
    .insert(graphSnapshotTable)
    .values({ hash, documentVersion: 1, document, firstCapturedAtMs: new Date(0) })
    .run();
  database
    .insert(workflowRunTable)
    .values({
      id: runId,
      workflowId,
      status: 'pending',
      input: {},
      providerId: 'minimax',
      rootRunId: runId,
      depth: 0,
      workflowAncestry: [workflowId],
      graphSnapshotHash: hash,
      persistedStreamDeltas: false,
      createdAtMs: new Date(0),
    })
    .run();
}

describe('insertEngineEventRow', () => {
  it('beszúr egy motor eredetű sort, és visszaadja a keletkezett eventId-t', () => {
    const { sqlite, database } = openMigratedDatabase();
    seedRun(database, 'workflow-1', 'run-1');

    const outcome = insertEngineEventRow(database, {
      runId: 'run-1',
      stepRunId: null,
      kind: 'run_started',
      occurredAtMs: new Date(1000),
      payload: { runId: 'run-1', workflowId: 'workflow-1' },
    });

    if (!isOkOutcome(outcome)) {
      throw new Error(`sikeres beszúrást vártunk: ${outcome.message}`);
    }
    expect(outcome.value.eventId).toBeGreaterThan(0);

    const row = database.select().from(runEventTable).where(eq(runEventTable.id, outcome.value.eventId)).get();
    expect(row).toStrictEqual({
      id: outcome.value.eventId,
      runId: 'run-1',
      stepRunId: null,
      origin: 'engine',
      kind: 'run_started',
      occurredAtMs: new Date(1000),
      sdkMessageType: null,
      sdkMessageSubtype: null,
      sdkSessionId: null,
      sdkUuid: null,
      parentToolUseId: null,
      toolName: null,
      toolUseId: null,
      inputTokens: null,
      outputTokens: null,
      cacheReadInputTokens: null,
      cacheCreationInputTokens: null,
      numTurns: null,
      payload: { runId: 'run-1', workflowId: 'workflow-1' },
    });

    sqlite.close();
  });

  it('nem hat rá a delta kapcsoló: kind = sdk_stream_event esetén is beszúr, kikapcsolt persisted_stream_deltas mellett', () => {
    // Ez a függvény szándékosan NEM a gated SQL-t futtatja (lásd a
    // dokumentációját): motor eredetű hívó soha nem ad `sdk_stream_event`
    // kind-ot (az `EngineRunEventKind` típus kizárja), de maga a függvény
    // nem is ismeri a gate fogalmát - ez a teszt ezt bizonyítja explicit
    // módon, még akkor is, ha a valós hívók sosem élnek ezzel.
    const { sqlite, database } = openMigratedDatabase();
    seedRun(database, 'workflow-1', 'run-1');

    const outcome = insertEngineEventRow(database, {
      runId: 'run-1',
      stepRunId: null,
      kind: 'sdk_stream_event',
      occurredAtMs: new Date(0),
      payload: {},
    });

    expect(isOkOutcome(outcome)).toBe(true);
    expect(database.select().from(runEventTable).all()).toHaveLength(1);

    sqlite.close();
  });

  it('lépéshez kötött eseménynél a stepRunId is beszúródik', () => {
    const { sqlite, database } = openMigratedDatabase();
    seedRun(database, 'workflow-1', 'run-1');
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

    const outcome = insertEngineEventRow(database, {
      runId: 'run-1',
      stepRunId: 'step-1',
      kind: 'step_started',
      occurredAtMs: new Date(1),
      payload: { nodeId: 'node-agent' },
    });

    if (!isOkOutcome(outcome)) {
      throw new Error(`sikeres beszúrást vártunk: ${outcome.message}`);
    }
    const row = database.select().from(runEventTable).where(eq(runEventTable.id, outcome.value.eventId)).get();
    expect(row?.kind).toBe('step_started');
    expect(row?.stepRunId).toBe('step-1');
    expect(row?.payload).toStrictEqual({ nodeId: 'node-agent' });

    sqlite.close();
  });

  it('not_found hibaágat ad, ha a run_id nem létezik', () => {
    const { sqlite, database } = openMigratedDatabase();

    const outcome = insertEngineEventRow(database, {
      runId: 'nincs-ilyen',
      stepRunId: null,
      kind: 'run_started',
      occurredAtMs: new Date(0),
      payload: {},
    });

    expect(isOkOutcome(outcome)).toBe(false);
    if (isOkOutcome(outcome)) {
      throw new Error('hibaágat vártunk');
    }
    expect(outcome.message).toContain('not_found');
    expect(database.select().from(runEventTable).all()).toStrictEqual([]);

    sqlite.close();
  });
});
