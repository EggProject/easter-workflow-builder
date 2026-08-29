/* eslint-disable unicorn/no-null -- a `workflow`/`step_run` séma nullázható mezői (description, providerId, ...) itt tárolt `null` értéket hordoznak, nem helyőrző `undefined`-et */
import SqliteDatabase from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { describeError, type Outcome } from '@easter-workflow-builder/core';
import { describe, expect, it } from 'vitest';
import { migrateDatabase } from '../migration/migrate-database.ts';
import { MIGRATIONS_FOLDER } from '../migration/migrations-folder.ts';
import { workflowTable } from '../workflow-graph/workflow/workflow.ts';
import { graphSnapshotTable } from '../graph-snapshot/stored-snapshot/graph-snapshot.ts';
import { computeSnapshotHash } from '../graph-snapshot/snapshot-hash/compute-snapshot-hash.ts';
import { workflowRunTable } from '../workflow-run/workflow-run.ts';
import type { RunStatus } from '../workflow-run/run-status.ts';
import { stepRunTable } from '../step-run/step-run.ts';
import type { StepRunStatus } from '../step-run/step-run-status.ts';
import { runEventTable } from '../run-event/event-record/run-event.ts';
import { createRunRecovery, type RunRecovery } from './run-recovery.ts';

/**
 * Ugyanaz a minta, mint a `human-approval-repository.spec.ts`-ben: a
 * `.spec.ts` fájl a `createRunRecovery`-t közvetlenül teszteli, nem az
 * `openDatabase` kompozíción keresztül, hogy legyen közvetlen `database`
 * hozzáférés az előfeltétel-sorok (tetszőleges kezdő állapotú futás/lépés)
 * nyers beszúrásához.
 */
class TransactionRollback extends Error {}

function makeTransaction(database: BetterSQLite3Database) {
  return function transaction<TValue>(work: () => Outcome<TValue>): Outcome<TValue> {
    try {
      const value = database.transaction((): TValue => {
        const result = work();
        if (result.kind === 'error') {
          throw new TransactionRollback(result.message);
        }
        return result.value;
      });
      return { kind: 'ok', value };
    } catch (error) {
      if (error instanceof TransactionRollback) {
        return { kind: 'error', message: error.message };
      }
      return { kind: 'error', message: describeError(error) };
    }
  };
}

function openRepository(): {
  sqlite: SqliteDatabase.Database;
  database: BetterSQLite3Database;
  repository: RunRecovery;
} {
  const sqlite = new SqliteDatabase(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const database = drizzle(sqlite);
  migrateDatabase(database, MIGRATIONS_FOLDER);
  const repository = createRunRecovery(database, makeTransaction(database));
  return { sqlite, database, repository };
}

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (outcome.kind !== 'ok') {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

function insertWorkflow(database: BetterSQLite3Database, id: string): void {
  database
    .insert(workflowTable)
    .values({ id, name: id, description: null, providerId: null, createdAtMs: new Date(0), updatedAtMs: new Date(0) })
    .run();
}

/**
 * Beszúr egy `graph_snapshot` és egy rá hivatkozó `workflow_run` sort, adott
 * kezdő állapottal (ugyanaz a minta, mint a `step-run-repository.spec.ts`
 * `insertRun`-jában, csak itt az állapot paraméterezhető). A `rootRunId`
 * opcionális: hiányában a sor a saját gyökere (gyökér futás), a
 * `cancelRunTree` fa teszteseteinél viszont egy MEGLÉVŐ futás azonosítóját
 * kapja, hogy al-workflow futást szimuláljon ugyanazon a gyökéren.
 */
function insertRun(
  database: BetterSQLite3Database,
  workflowId: string,
  runId: string,
  status: RunStatus,
  rootRunId: string = runId,
): void {
  const document = { seed: runId };
  const hash = computeSnapshotHash(`${runId}:${JSON.stringify(document)}`);
  database
    .insert(graphSnapshotTable)
    .values({ hash, documentVersion: 1, document, firstCapturedAtMs: new Date(0) })
    .run();
  database
    .insert(workflowRunTable)
    .values({
      id: runId,
      workflowId,
      status,
      input: {},
      providerId: 'minimax',
      rootRunId,
      depth: rootRunId === runId ? 0 : 1,
      workflowAncestry: [workflowId],
      graphSnapshotHash: hash,
      persistedStreamDeltas: false,
      createdAtMs: new Date(0),
    })
    .run();
}

function insertStep(database: BetterSQLite3Database, runId: string, stepId: string, status: StepRunStatus): void {
  database
    .insert(stepRunTable)
    .values({
      id: stepId,
      runId,
      nodeId: stepId,
      nodeType: 'agent_step',
      status,
      providerId: 'minimax',
      createdAtMs: new Date(0),
    })
    .run();
}

describe('createRunRecovery', () => {
  describe('recoverInterruptedRuns', () => {
    it('minden pending és running futást interrupted állapotba visz, a nem terminális lépés futásokkal együtt, futásonként egy run_interrupted eseménnyel', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');

      insertRun(database, 'w1', 'run-pending', 'pending');
      insertStep(database, 'run-pending', 'step-1', 'pending');

      insertRun(database, 'w1', 'run-running', 'running');
      insertStep(database, 'run-running', 'step-2', 'running');
      insertStep(database, 'run-running', 'step-3', 'waiting_approval');

      const result = okOrThrow(repository.recoverInterruptedRuns('startup_recovery'));
      expect(result.recoveredRunCount).toBe(2);

      const runPending = database.select().from(workflowRunTable).where(eq(workflowRunTable.id, 'run-pending')).get();
      expect(runPending?.status).toBe('interrupted');
      expect(runPending?.finishedAtMs).toBeInstanceOf(Date);

      const runRunning = database.select().from(workflowRunTable).where(eq(workflowRunTable.id, 'run-running')).get();
      expect(runRunning?.status).toBe('interrupted');
      expect(runRunning?.finishedAtMs).toBeInstanceOf(Date);

      const step1 = database.select().from(stepRunTable).where(eq(stepRunTable.id, 'step-1')).get();
      expect(step1?.status).toBe('interrupted');
      expect(step1?.finishedAtMs).toBeInstanceOf(Date);

      const step2 = database.select().from(stepRunTable).where(eq(stepRunTable.id, 'step-2')).get();
      expect(step2?.status).toBe('interrupted');

      const step3 = database.select().from(stepRunTable).where(eq(stepRunTable.id, 'step-3')).get();
      expect(step3?.status).toBe('interrupted');

      // Futásonként pontosan egy run_interrupted esemény, motor eredetű,
      // futás szintű (stepRunId NULL) (SPEC-003 7.4 szekció).
      const events = database.select().from(runEventTable).all();
      expect(events).toHaveLength(2);
      const eventRunIds = events.map((event) => event.runId).toSorted((a, b) => a.localeCompare(b));
      expect(eventRunIds).toStrictEqual(['run-pending', 'run-running']);
      for (const event of events) {
        expect(event.origin).toBe('engine');
        expect(event.kind).toBe('run_interrupted');
        expect(event.stepRunId).toBeNull();
        expect(event.payload).toStrictEqual({ reason: 'startup_recovery' });
      }

      sqlite.close();
    });

    it('a reason paramétert változatlanul, szó szerint írja a payload-ba (graceful_shutdown eset)', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      insertRun(database, 'w1', 'run-running', 'running');

      okOrThrow(repository.recoverInterruptedRuns('graceful_shutdown'));

      const events = database.select().from(runEventTable).all();
      expect(events).toHaveLength(1);
      expect(events[0]?.payload).toStrictEqual({ reason: 'graceful_shutdown' });

      sqlite.close();
    });

    it('terminális futás és a hozzá tartozó terminális lépés futás érintetlen marad', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      insertRun(database, 'w1', 'run-done', 'succeeded');
      insertStep(database, 'run-done', 'step-done', 'succeeded');

      // Őrjel érték: ha a helyreállítás tévedésből mégis hozzányúlna ehhez a
      // terminális sorhoz, ez az érték felülíródna - a teszt ezt igazolja,
      // nem csak azt, hogy a `status` (ami eleve nincs a WHERE feltételben)
      // véletlenül változatlan maradt.
      const sentinel = new Date(123_456);
      database
        .update(workflowRunTable)
        .set({ finishedAtMs: sentinel })
        .where(eq(workflowRunTable.id, 'run-done'))
        .run();
      database.update(stepRunTable).set({ finishedAtMs: sentinel }).where(eq(stepRunTable.id, 'step-done')).run();

      const result = okOrThrow(repository.recoverInterruptedRuns('startup_recovery'));
      expect(result.recoveredRunCount).toBe(0);

      const run = database.select().from(workflowRunTable).where(eq(workflowRunTable.id, 'run-done')).get();
      expect(run?.status).toBe('succeeded');
      expect(run?.finishedAtMs).toStrictEqual(sentinel);

      const step = database.select().from(stepRunTable).where(eq(stepRunTable.id, 'step-done')).get();
      expect(step?.status).toBe('succeeded');
      expect(step?.finishedAtMs).toStrictEqual(sentinel);

      const events = database.select().from(runEventTable).all();
      expect(events).toHaveLength(0);

      sqlite.close();
    });

    it('nulla pending/running futás esetén recoveredRunCount 0, és nem ír eseményt', () => {
      const { sqlite, database, repository } = openRepository();

      const result = okOrThrow(repository.recoverInterruptedRuns('startup_recovery'));
      expect(result.recoveredRunCount).toBe(0);

      const events = database.select().from(runEventTable).all();
      expect(events).toHaveLength(0);

      sqlite.close();
    });

    it('egy running futáson belül csak a nem terminális lépés futások változnak, a terminális lépés futás érintetlen marad', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      insertRun(database, 'w1', 'run-mixed', 'running');
      insertStep(database, 'run-mixed', 'step-running', 'running');
      insertStep(database, 'run-mixed', 'step-succeeded', 'succeeded');

      okOrThrow(repository.recoverInterruptedRuns('startup_recovery'));

      const runningStep = database.select().from(stepRunTable).where(eq(stepRunTable.id, 'step-running')).get();
      expect(runningStep?.status).toBe('interrupted');

      const succeededStep = database.select().from(stepRunTable).where(eq(stepRunTable.id, 'step-succeeded')).get();
      expect(succeededStep?.status).toBe('succeeded');

      sqlite.close();
    });
  });

  describe('cancelRunTree', () => {
    it('a gyökér futást és az azonos gyökerű al-workflow futást is cancelled állapotba viszi, a nem terminális lépésekkel együtt', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');

      insertRun(database, 'w1', 'root-run', 'running');
      insertStep(database, 'root-run', 'root-step', 'running');

      // Al-workflow futás: azonos `rootRunId`, mint a `root-run` (5.9 szekció).
      insertRun(database, 'w1', 'child-run', 'running', 'root-run');
      insertStep(database, 'child-run', 'child-step', 'waiting_approval');

      const result = okOrThrow(repository.cancelRunTree('root-run'));
      expect(new Set(result.cancelledRunIds)).toStrictEqual(new Set(['root-run', 'child-run']));

      const rootRun = database.select().from(workflowRunTable).where(eq(workflowRunTable.id, 'root-run')).get();
      expect(rootRun?.status).toBe('cancelled');
      expect(rootRun?.finishedAtMs).toBeInstanceOf(Date);

      const childRun = database.select().from(workflowRunTable).where(eq(workflowRunTable.id, 'child-run')).get();
      expect(childRun?.status).toBe('cancelled');

      const rootStep = database.select().from(stepRunTable).where(eq(stepRunTable.id, 'root-step')).get();
      expect(rootStep?.status).toBe('cancelled');
      expect(rootStep?.finishedAtMs).toBeInstanceOf(Date);

      const childStep = database.select().from(stepRunTable).where(eq(stepRunTable.id, 'child-step')).get();
      expect(childStep?.status).toBe('cancelled');

      // Futásonként pontosan egy `run_finished` esemény, `status: 'cancelled'`
      // payloaddal, hiba nélkül (SPEC-004 9. szekció 5. pont, 13. szekció).
      const events = database.select().from(runEventTable).all();
      expect(events).toHaveLength(2);
      for (const event of events) {
        expect(event.origin).toBe('engine');
        expect(event.kind).toBe('run_finished');
        expect(event.stepRunId).toBeNull();
        expect(event.payload).toStrictEqual({
          status: 'cancelled',
          errorKind: null,
          errorMessage: null,
          failedBranchCount: 0,
        });
      }

      sqlite.close();
    });

    it('már terminális lépést és futást érintetlenül hagy, csak a nem terminálisokat viszi cancelled állapotba', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      insertRun(database, 'w1', 'root-run', 'running');
      insertStep(database, 'root-run', 'step-running', 'running');
      insertStep(database, 'root-run', 'step-done', 'succeeded');

      const sentinel = new Date(123_456);
      database.update(stepRunTable).set({ finishedAtMs: sentinel }).where(eq(stepRunTable.id, 'step-done')).run();

      okOrThrow(repository.cancelRunTree('root-run'));

      const runningStep = database.select().from(stepRunTable).where(eq(stepRunTable.id, 'step-running')).get();
      expect(runningStep?.status).toBe('cancelled');

      const doneStep = database.select().from(stepRunTable).where(eq(stepRunTable.id, 'step-done')).get();
      expect(doneStep?.status).toBe('succeeded');
      expect(doneStep?.finishedAtMs).toStrictEqual(sentinel);

      sqlite.close();
    });

    it('egy másik futás fája érintetlen marad: a szűrés a root_run_id oszlopra szűkít', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      insertRun(database, 'w1', 'root-a', 'running');
      insertRun(database, 'w1', 'root-b', 'running');
      insertStep(database, 'root-b', 'step-b', 'running');

      const result = okOrThrow(repository.cancelRunTree('root-a'));
      expect(result.cancelledRunIds).toStrictEqual(['root-a']);

      const runB = database.select().from(workflowRunTable).where(eq(workflowRunTable.id, 'root-b')).get();
      expect(runB?.status).toBe('running');

      const stepB = database.select().from(stepRunTable).where(eq(stepRunTable.id, 'step-b')).get();
      expect(stepB?.status).toBe('running');

      sqlite.close();
    });

    it('teljesen terminális fára cancelledRunIds üres lista, és nem ír eseményt', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      insertRun(database, 'w1', 'root-run', 'succeeded');
      insertStep(database, 'root-run', 'step-done', 'succeeded');

      const result = okOrThrow(repository.cancelRunTree('root-run'));
      expect(result.cancelledRunIds).toStrictEqual([]);

      const run = database.select().from(workflowRunTable).where(eq(workflowRunTable.id, 'root-run')).get();
      expect(run?.status).toBe('succeeded');

      const events = database.select().from(runEventTable).all();
      expect(events).toHaveLength(0);

      sqlite.close();
    });

    it('ismeretlen root_run_id-ra cancelledRunIds üres lista, hiba nélkül', () => {
      const { sqlite, repository } = openRepository();

      const result = okOrThrow(repository.cancelRunTree('nincs-ilyen-futas'));
      expect(result.cancelledRunIds).toStrictEqual([]);

      sqlite.close();
    });
  });
});
