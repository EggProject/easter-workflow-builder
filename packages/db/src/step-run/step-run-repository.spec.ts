/* eslint-disable unicorn/no-null -- a StepRunRecord és a CreateStepRunInput/AttachSessionInput nullázható mezői (parentStepRunId, resumedFrom, ...) tárolt/visszaadott `null` értéket hordoznak, nem helyőrző `undefined`-et */
import SqliteDatabase from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { describeError, type Outcome } from '@easter-workflow-builder/core';
import { describe, expect, it } from 'vitest';
import { migrateDatabase } from '../migration/migrate-database.ts';
import { MIGRATIONS_FOLDER } from '../migration/migrations-folder.ts';
import { workflowTable } from '../workflow-graph/workflow.ts';
import { graphSnapshotTable } from '../graph-snapshot/graph-snapshot.ts';
import { computeSnapshotHash } from '../graph-snapshot/compute-snapshot-hash.ts';
import { workflowRunTable } from '../workflow-run/workflow-run.ts';
import { createRunEventRepository, type RunEventRepository } from '../run-event/event-record/run-event-repository.ts';
import { stepRunTable } from './step-run.ts';
import {
  createStepRunRepository,
  type AttachSessionInput,
  type CreateStepRunInput,
  type StepRunRecord,
  type StepRunRepository,
} from './step-run-repository.ts';

/**
 * Ugyanaz a minta, mint a `workflow-run/workflow-run-repository.spec.ts`-ben:
 * a `.spec.ts` fájl a `createStepRunRepository`-t közvetlenül teszteli, nem
 * az `openDatabase` kompozíción keresztül, hogy legyen közvetlen `database`
 * hozzáférés a nyers beszúrásokhoz (korrupt adat szimuláció).
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
  repository: StepRunRepository;
  runEvents: RunEventRepository;
} {
  const sqlite = new SqliteDatabase(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const database = drizzle(sqlite);
  migrateDatabase(database, MIGRATIONS_FOLDER);
  const transaction = makeTransaction(database);
  const repository = createStepRunRepository(database, transaction);
  // A 60. kritérium tesztje (lent, "a delta kapcsoló nem érinti a step_run
  // token oszlopait") a `RunEventRepository`-t is igényli, hogy ténylegesen
  // eltérő számú `run_event` sort tudjon írni a kapcsoló két állásában,
  // ugyanazon a `database`/`transaction` páron, mint a `StepRunRepository`.
  const runEvents = createRunEventRepository(database, transaction);
  return { sqlite, database, repository, runEvents };
}

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (outcome.kind !== 'ok') {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

function errorOrThrow<TValue>(outcome: Outcome<TValue>): string {
  if (outcome.kind !== 'error') {
    throw new Error('hibaágat vártunk');
  }
  return outcome.message;
}

function insertWorkflow(database: BetterSQLite3Database, id: string): void {
  database
    .insert(workflowTable)
    .values({ id, name: id, description: null, providerId: null, createdAtMs: new Date(0), updatedAtMs: new Date(0) })
    .run();
}

/**
 * Beszúr egy `graph_snapshot` és egy rá hivatkozó `workflow_run` sort, és
 * visszaadja a futás azonosítóját. A `step_run` idegen kulcsa a
 * `workflow_run` táblára mutat (SPEC-003 4.10), ezért minden teszthez kell
 * egy létező futás. Az `isPersistStreamDeltasEnabled` paraméter adja a 6.6
 * szekció befagyasztott kapcsolóját (alapból kikapcsolva, a séma szintű
 * alapértéknek megfelelően) - a 60. kritérium tesztje (lent) mindkét
 * állásban hív erre egy-egy futást.
 */
function insertRun(
  database: BetterSQLite3Database,
  workflowId: string,
  runId: string,
  isPersistStreamDeltasEnabled = false,
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
      status: 'pending',
      input: {},
      providerId: 'minimax',
      rootRunId: runId,
      depth: 0,
      workflowAncestry: [workflowId],
      graphSnapshotHash: hash,
      persistedStreamDeltas: isPersistStreamDeltasEnabled,
      createdAtMs: new Date(0),
    })
    .run();
}

function baseCreateInput(runId: string, extra: Partial<CreateStepRunInput> = {}): CreateStepRunInput {
  return {
    runId,
    nodeId: 'node-1',
    nodeType: 'agent_step',
    parentStepRunId: null,
    providerId: 'minimax',
    modelId: null,
    sessionMode: null,
    structuredOutputStrategy: null,
    subWorkflowRunId: null,
    ...extra,
  };
}

function create(repository: StepRunRepository, runId: string, extra: Partial<CreateStepRunInput> = {}): StepRunRecord {
  return okOrThrow(repository.createStepRun(baseCreateInput(runId, extra)));
}

describe('createStepRunRepository', () => {
  describe('createStepRun', () => {
    it('pending kezdő állapotot ad, technikai alapértékekkel (iteration 0, attempt 1, forkedSession hamis)', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      insertRun(database, 'w1', 'run-1');

      const step = create(repository, 'run-1');

      expect(step.status).toBe('pending');
      expect(step.iteration).toBe(0);
      expect(step.attempt).toBe(1);
      expect(step.forkedSession).toBe(false);
      expect(step.parentStepRunId).toBeNull();
      expect(step.modelId).toBeNull();
      expect(step.sessionMode).toBeNull();
      expect(step.sdkSessionId).toBeNull();
      expect(step.resumedFromSessionId).toBeNull();
      expect(step.structuredOutputStrategy).toBeNull();
      expect(step.output).toBeNull();
      expect(step.resultSubtype).toBeNull();
      expect(step.numTurns).toBeNull();
      expect(step.inputTokens).toBeNull();
      expect(step.outputTokens).toBeNull();
      expect(step.cacheReadInputTokens).toBeNull();
      expect(step.cacheCreationInputTokens).toBeNull();
      expect(step.subWorkflowRunId).toBeNull();
      expect(step.errorKind).toBeNull();
      expect(step.errorMessage).toBeNull();
      expect(step.startedAtMs).toBeNull();
      expect(step.finishedAtMs).toBeNull();

      sqlite.close();
    });

    it('a hívó által megadott iteration/attempt és minden kitöltött mezőt megőrzi', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      insertRun(database, 'w1', 'run-1');
      const parent = create(repository, 'run-1');
      insertRun(database, 'w1', 'run-sub');

      const step = create(repository, 'run-1', {
        nodeId: 'node-2',
        nodeType: 'sub_workflow',
        parentStepRunId: parent.id,
        iteration: 2,
        attempt: 3,
        providerId: 'claude-subscription',
        modelId: 'claude-opus-4',
        sessionMode: 'continued',
        structuredOutputStrategy: 'emit_output_tool',
        subWorkflowRunId: 'run-sub',
      });

      expect(step.nodeId).toBe('node-2');
      expect(step.nodeType).toBe('sub_workflow');
      expect(step.parentStepRunId).toBe(parent.id);
      expect(step.iteration).toBe(2);
      expect(step.attempt).toBe(3);
      expect(step.providerId).toBe('claude-subscription');
      expect(step.modelId).toBe('claude-opus-4');
      expect(step.sessionMode).toBe('continued');
      expect(step.structuredOutputStrategy).toBe('emit_output_tool');
      expect(step.subWorkflowRunId).toBe('run-sub');

      sqlite.close();
    });
  });

  describe('listStepRuns / getStepRun', () => {
    it('not_found hibaágat ad ismeretlen stepRunId-ra', () => {
      const { sqlite, repository } = openRepository();
      expect(errorOrThrow(repository.getStepRun('nincs-ilyen'))).toContain('not_found');
      sqlite.close();
    });

    it('getStepRun visszaadja a createStepRun által létrehozott sort', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      insertRun(database, 'w1', 'run-1');
      const created = create(repository, 'run-1');

      const fetched = okOrThrow(repository.getStepRun(created.id));
      expect(fetched).toStrictEqual(created);

      sqlite.close();
    });

    it('listStepRuns created_at_ms szerint növekvő sorrendben ad listát, futásonként szűrve', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      insertRun(database, 'w1', 'run-1');
      insertRun(database, 'w1', 'run-2');

      const first = create(repository, 'run-1', { nodeId: 'node-a' });
      database
        .update(stepRunTable)
        .set({ createdAtMs: new Date(3000) })
        .where(eq(stepRunTable.id, first.id))
        .run();
      const second = create(repository, 'run-1', { nodeId: 'node-b' });
      database
        .update(stepRunTable)
        .set({ createdAtMs: new Date(1000) })
        .where(eq(stepRunTable.id, second.id))
        .run();
      const other = create(repository, 'run-2', { nodeId: 'node-c' });
      database
        .update(stepRunTable)
        .set({ createdAtMs: new Date(2000) })
        .where(eq(stepRunTable.id, other.id))
        .run();

      const forRun1 = okOrThrow(repository.listStepRuns('run-1'));
      expect(forRun1.map((step) => step.id)).toStrictEqual([second.id, first.id]);

      const forRun2 = okOrThrow(repository.listStepRuns('run-2'));
      expect(forRun2.map((step) => step.id)).toStrictEqual([other.id]);

      sqlite.close();
    });

    it('üres listát ad, ha egy futásnak nincs lépés futása', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      insertRun(database, 'w1', 'run-1');
      expect(okOrThrow(repository.listStepRuns('run-1'))).toStrictEqual([]);
      sqlite.close();
    });

    it('invalid_provider_id hibaágat ad, ha a tárolt provider_id nem érvényes ProviderId (korrupt adat)', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      insertRun(database, 'w1', 'run-1');
      database
        .insert(stepRunTable)
        .values({
          id: 'corrupt-step',
          runId: 'run-1',
          nodeId: 'node-1',
          nodeType: 'agent_step',
          status: 'pending',
          providerId: 'nem-letezo-provider',
          createdAtMs: new Date(0),
        })
        .run();

      expect(errorOrThrow(repository.getStepRun('corrupt-step'))).toContain('invalid_provider_id');
      expect(errorOrThrow(repository.listStepRuns('run-1'))).toContain('invalid_provider_id');

      sqlite.close();
    });

    it('invalid_step_run_status hibaágat ad, ha a tárolt status nem érvényes StepRunStatus (korrupt adat)', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      insertRun(database, 'w1', 'run-1');
      database
        .insert(stepRunTable)
        .values({
          id: 'corrupt-step-2',
          runId: 'run-1',
          nodeId: 'node-1',
          nodeType: 'agent_step',
          status: 'nem-letezo-status',
          providerId: 'minimax',
          createdAtMs: new Date(0),
        })
        .run();

      expect(errorOrThrow(repository.getStepRun('corrupt-step-2'))).toContain('invalid_step_run_status');

      sqlite.close();
    });
  });

  describe('állapotváltók (compare and set)', () => {
    it('markStepRunning: pending -> running, beállítja a startedAtMs mezőt', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      insertRun(database, 'w1', 'run-1');
      const step = create(repository, 'run-1');

      const running = okOrThrow(repository.markStepRunning(step.id));
      expect(running.status).toBe('running');
      expect(running.startedAtMs).toBeInstanceOf(Date);

      sqlite.close();
    });

    it('markStepRunning illegal_status_transition hibaágat ad, ha a lépés futás már running', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      insertRun(database, 'w1', 'run-1');
      const step = create(repository, 'run-1');
      okOrThrow(repository.markStepRunning(step.id));

      expect(errorOrThrow(repository.markStepRunning(step.id))).toContain('illegal_status_transition');

      sqlite.close();
    });

    it('markStepRunning illegal_status_transition hibaágat ad ismeretlen stepRunId-ra', () => {
      const { sqlite, repository } = openRepository();
      expect(errorOrThrow(repository.markStepRunning('nincs-ilyen'))).toContain('illegal_status_transition');
      sqlite.close();
    });

    it('markStepWaitingApproval: running -> waiting_approval', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      insertRun(database, 'w1', 'run-1');
      const step = create(repository, 'run-1');
      okOrThrow(repository.markStepRunning(step.id));

      const waiting = okOrThrow(repository.markStepWaitingApproval(step.id));
      expect(waiting.status).toBe('waiting_approval');

      sqlite.close();
    });

    it('markStepWaitingApproval illegal_status_transition hibaágat ad pending állapotból', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      insertRun(database, 'w1', 'run-1');
      const step = create(repository, 'run-1');

      expect(errorOrThrow(repository.markStepWaitingApproval(step.id))).toContain('illegal_status_transition');

      sqlite.close();
    });

    it('markStepSucceeded: running -> succeeded, beállítja a finishedAtMs mezőt, output nélkül is (nincs structuredOutputStrategy)', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      insertRun(database, 'w1', 'run-1');
      const step = create(repository, 'run-1');
      okOrThrow(repository.markStepRunning(step.id));

      const succeeded = okOrThrow(repository.markStepSucceeded(step.id));
      expect(succeeded.status).toBe('succeeded');
      expect(succeeded.finishedAtMs).toBeInstanceOf(Date);
      expect(succeeded.output).toBeNull();

      sqlite.close();
    });

    it('markStepSucceeded elmenti az output mezőt, ha a hívó megadja', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      insertRun(database, 'w1', 'run-1');
      const step = create(repository, 'run-1');
      okOrThrow(repository.markStepRunning(step.id));

      const succeeded = okOrThrow(repository.markStepSucceeded(step.id, { output: { answer: 42 } }));
      expect(succeeded.output).toStrictEqual({ answer: 42 });

      sqlite.close();
    });

    it('markStepSucceeded waiting_approval -> succeeded is engedett (jóváhagyás után)', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      insertRun(database, 'w1', 'run-1');
      const step = create(repository, 'run-1', { nodeType: 'human_approval' });
      okOrThrow(repository.markStepRunning(step.id));
      okOrThrow(repository.markStepWaitingApproval(step.id));

      const succeeded = okOrThrow(repository.markStepSucceeded(step.id));
      expect(succeeded.status).toBe('succeeded');

      sqlite.close();
    });

    it('missing_structured_output hibaágat ad, ha structuredOutputStrategy ki van töltve, de output nincs megadva (7.2 M-34)', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      insertRun(database, 'w1', 'run-1');
      const step = create(repository, 'run-1', { structuredOutputStrategy: 'sdk_output_format' });
      okOrThrow(repository.markStepRunning(step.id));

      const outcome = repository.markStepSucceeded(step.id);
      expect(errorOrThrow(outcome)).toContain('missing_structured_output');

      // A sor NEM ment át succeeded állapotba, semmilyen mező nem változott.
      const stillRunning = okOrThrow(repository.getStepRun(step.id));
      expect(stillRunning.status).toBe('running');
      expect(stillRunning.output).toBeNull();
      expect(stillRunning.finishedAtMs).toBeNull();

      sqlite.close();
    });

    it('markStepSucceeded sikeres, ha structuredOutputStrategy ki van töltve ÉS output is meg van adva', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      insertRun(database, 'w1', 'run-1');
      const step = create(repository, 'run-1', { structuredOutputStrategy: 'emit_output_tool' });
      okOrThrow(repository.markStepRunning(step.id));

      const succeeded = okOrThrow(repository.markStepSucceeded(step.id, { output: { ok: true } }));
      expect(succeeded.status).toBe('succeeded');
      expect(succeeded.output).toStrictEqual({ ok: true });

      sqlite.close();
    });

    it('markStepSucceeded illegal_status_transition hibaágat ad ismeretlen stepRunId-ra', () => {
      const { sqlite, repository } = openRepository();
      expect(errorOrThrow(repository.markStepSucceeded('nincs-ilyen'))).toContain('illegal_status_transition');
      sqlite.close();
    });

    it('markStepFailed: running -> failed, beállítja a finishedAtMs, errorKind és errorMessage mezőt', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      insertRun(database, 'w1', 'run-1');
      const step = create(repository, 'run-1');
      okOrThrow(repository.markStepRunning(step.id));

      const failed = okOrThrow(repository.markStepFailed(step.id, 'timeout', 'A lépés túllépte az időkeretet.'));
      expect(failed.status).toBe('failed');
      expect(failed.finishedAtMs).toBeInstanceOf(Date);
      expect(failed.errorKind).toBe('timeout');
      expect(failed.errorMessage).toBe('A lépés túllépte az időkeretet.');

      sqlite.close();
    });

    it('markStepFailed missing_structured_output errorKind-del rögzíthető, amikor a motor így dönt', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      insertRun(database, 'w1', 'run-1');
      const step = create(repository, 'run-1', { structuredOutputStrategy: 'sdk_output_format' });
      okOrThrow(repository.markStepRunning(step.id));

      const failed = okOrThrow(
        repository.markStepFailed(
          step.id,
          'missing_structured_output',
          'Nincs strukturált kimenet a result üzenetben.',
        ),
      );
      expect(failed.status).toBe('failed');
      expect(failed.errorKind).toBe('missing_structured_output');

      sqlite.close();
    });

    it('markStepFailed illegal_status_transition hibaágat ad terminális állapotból', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      insertRun(database, 'w1', 'run-1');
      const step = create(repository, 'run-1');
      okOrThrow(repository.markStepRunning(step.id));
      okOrThrow(repository.markStepSucceeded(step.id));

      expect(errorOrThrow(repository.markStepFailed(step.id, 'timeout', 'x'))).toContain('illegal_status_transition');

      sqlite.close();
    });

    it('markStepRejected: waiting_approval -> rejected, beállítja a finishedAtMs mezőt', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      insertRun(database, 'w1', 'run-1');
      const step = create(repository, 'run-1', { nodeType: 'human_approval' });
      okOrThrow(repository.markStepRunning(step.id));
      okOrThrow(repository.markStepWaitingApproval(step.id));

      const rejected = okOrThrow(repository.markStepRejected(step.id));
      expect(rejected.status).toBe('rejected');
      expect(rejected.finishedAtMs).toBeInstanceOf(Date);

      sqlite.close();
    });

    it('markStepRejected illegal_status_transition hibaágat ad running állapotból (waiting_approval kihagyva)', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      insertRun(database, 'w1', 'run-1');
      const step = create(repository, 'run-1');
      okOrThrow(repository.markStepRunning(step.id));

      expect(errorOrThrow(repository.markStepRejected(step.id))).toContain('illegal_status_transition');

      sqlite.close();
    });

    it('markStepCancelled: pending, running és waiting_approval állapotból is engedett, beállítja a finishedAtMs mezőt', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      insertRun(database, 'w1', 'run-1');

      const fromPending = create(repository, 'run-1', { nodeId: 'a' });
      const cancelledFromPending = okOrThrow(repository.markStepCancelled(fromPending.id));
      expect(cancelledFromPending.status).toBe('cancelled');
      expect(cancelledFromPending.finishedAtMs).toBeInstanceOf(Date);

      const fromRunning = create(repository, 'run-1', { nodeId: 'b' });
      okOrThrow(repository.markStepRunning(fromRunning.id));
      expect(okOrThrow(repository.markStepCancelled(fromRunning.id)).status).toBe('cancelled');

      const fromWaiting = create(repository, 'run-1', { nodeId: 'c', nodeType: 'human_approval' });
      okOrThrow(repository.markStepRunning(fromWaiting.id));
      okOrThrow(repository.markStepWaitingApproval(fromWaiting.id));
      expect(okOrThrow(repository.markStepCancelled(fromWaiting.id)).status).toBe('cancelled');

      sqlite.close();
    });

    it('markStepCancelled illegal_status_transition hibaágat ad terminális állapotból', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      insertRun(database, 'w1', 'run-1');
      const step = create(repository, 'run-1');
      okOrThrow(repository.markStepRunning(step.id));
      okOrThrow(repository.markStepSucceeded(step.id));

      expect(errorOrThrow(repository.markStepCancelled(step.id))).toContain('illegal_status_transition');

      sqlite.close();
    });

    it('markStepInterrupted: pending, running és waiting_approval állapotból is engedett, beállítja a finishedAtMs mezőt', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      insertRun(database, 'w1', 'run-1');

      const fromPending = create(repository, 'run-1', { nodeId: 'a' });
      const interruptedFromPending = okOrThrow(repository.markStepInterrupted(fromPending.id));
      expect(interruptedFromPending.status).toBe('interrupted');
      expect(interruptedFromPending.finishedAtMs).toBeInstanceOf(Date);

      const fromRunning = create(repository, 'run-1', { nodeId: 'b' });
      okOrThrow(repository.markStepRunning(fromRunning.id));
      expect(okOrThrow(repository.markStepInterrupted(fromRunning.id)).status).toBe('interrupted');

      const fromWaiting = create(repository, 'run-1', { nodeId: 'c', nodeType: 'human_approval' });
      okOrThrow(repository.markStepRunning(fromWaiting.id));
      okOrThrow(repository.markStepWaitingApproval(fromWaiting.id));
      expect(okOrThrow(repository.markStepInterrupted(fromWaiting.id)).status).toBe('interrupted');

      sqlite.close();
    });

    it('markStepInterrupted illegal_status_transition hibaágat ad terminális állapotból', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      insertRun(database, 'w1', 'run-1');
      const step = create(repository, 'run-1');
      okOrThrow(repository.markStepRunning(step.id));
      okOrThrow(repository.markStepSucceeded(step.id));

      expect(errorOrThrow(repository.markStepInterrupted(step.id))).toContain('illegal_status_transition');

      sqlite.close();
    });

    it('a token oszlopok a terminális átmenettel egyszer íródnak, és utána nem módosíthatók', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      insertRun(database, 'w1', 'run-1');
      const step = create(repository, 'run-1');
      okOrThrow(repository.markStepRunning(step.id));

      const succeeded = okOrThrow(
        repository.markStepSucceeded(step.id, {
          tokens: { inputTokens: 100, outputTokens: 50, cacheReadInputTokens: 10, cacheCreationInputTokens: 5 },
        }),
      );
      expect(succeeded.inputTokens).toBe(100);
      expect(succeeded.outputTokens).toBe(50);
      expect(succeeded.cacheReadInputTokens).toBe(10);
      expect(succeeded.cacheCreationInputTokens).toBe(5);

      // A sor már terminális (succeeded), egy második hívás - akár más token
      // értékekkel is - illegal_status_transition hibát ad, és a korábban
      // beírt token oszlopok érintetlenek maradnak.
      const secondAttempt = repository.markStepSucceeded(step.id, {
        tokens: { inputTokens: 999, outputTokens: 999, cacheReadInputTokens: 999, cacheCreationInputTokens: 999 },
      });
      expect(errorOrThrow(secondAttempt)).toContain('illegal_status_transition');

      const reread = okOrThrow(repository.getStepRun(step.id));
      expect(reread.inputTokens).toBe(100);
      expect(reread.outputTokens).toBe(50);
      expect(reread.cacheReadInputTokens).toBe(10);
      expect(reread.cacheCreationInputTokens).toBe(5);

      sqlite.close();
    });

    it('markStepFailed is elmenti a token összesítést, ugyanabban a tranzakcióban', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      insertRun(database, 'w1', 'run-1');
      const step = create(repository, 'run-1');
      okOrThrow(repository.markStepRunning(step.id));

      const failed = okOrThrow(
        repository.markStepFailed(step.id, 'timeout', 'x', {
          tokens: { inputTokens: 7, outputTokens: 3, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
        }),
      );
      expect(failed.inputTokens).toBe(7);
      expect(failed.outputTokens).toBe(3);

      sqlite.close();
    });
  });

  describe('attachSession', () => {
    it('beállítja a sdkSessionId, resumedFromSessionId és forkedSession mezőt', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      insertRun(database, 'w1', 'run-1');
      const step = create(repository, 'run-1', { sessionMode: 'continued' });
      okOrThrow(repository.markStepRunning(step.id));

      const input: AttachSessionInput = { sessionId: 'sdk-session-1', resumedFrom: 'sdk-session-0', forked: true };
      const attached = okOrThrow(repository.attachSession(step.id, input));

      expect(attached.sdkSessionId).toBe('sdk-session-1');
      expect(attached.resumedFromSessionId).toBe('sdk-session-0');
      expect(attached.forkedSession).toBe(true);
      // Nem állapotváltás: a status változatlan marad.
      expect(attached.status).toBe('running');

      sqlite.close();
    });

    it('resumedFrom null lehet isolated session módnál', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      insertRun(database, 'w1', 'run-1');
      const step = create(repository, 'run-1', { sessionMode: 'isolated' });
      okOrThrow(repository.markStepRunning(step.id));

      const attached = okOrThrow(
        repository.attachSession(step.id, { sessionId: 'sdk-session-2', resumedFrom: null, forked: false }),
      );
      expect(attached.sdkSessionId).toBe('sdk-session-2');
      expect(attached.resumedFromSessionId).toBeNull();
      expect(attached.forkedSession).toBe(false);

      sqlite.close();
    });

    it('not_found hibaágat ad ismeretlen stepRunId-ra', () => {
      const { sqlite, repository } = openRepository();
      const outcome = repository.attachSession('nincs-ilyen', { sessionId: 'x', resumedFrom: null, forked: false });
      expect(errorOrThrow(outcome)).toContain('not_found');
      sqlite.close();
    });
  });
});

/**
 * SPEC-003 15. szekció 60. kritérium, T-003-28 átvizsgálás: "...a `step_run`
 * négy token oszlopa a kapcsoló mindkét állásában azonos értéket vesz fel."
 * Ez a `describe('állapotváltók ...')` blokk token tesztjeitől (fent) abban
 * tér el, hogy nem egy futáson belül nézi a token oszlopokat, hanem KÉT,
 * eltérő `persisted_stream_deltas` állású futást hasonlít össze, ugyanazzal
 * a token bemenettel - ez bizonyítja, hogy a kapcsoló, ami a `run_event`
 * sorok SZÁMÁT befolyásolja (58., 59. kritérium), a `step_run` négy token
 * oszlopára NINCS hatással, mert a `markStepSucceeded`/`markStepFailed` a
 * hívó által átadott `tokens` bemenetből tölti őket, nem a `run_event`
 * táblából származtatva (szemben az `aggregateRunTokens`-szel, ami a
 * `run-event-repository.spec.ts`-ben már bizonyítottan kapcsoló-független).
 */
describe('a step_run négy token oszlopa a delta kapcsoló mindkét állásában azonos (60. kritérium)', () => {
  it('ugyanaz a tokens bemenet ugyanazt a négy oszlopértéket adja vissza, függetlenül a beszúrt run_event sorok számától', () => {
    const { sqlite, database, repository, runEvents } = openRepository();
    insertWorkflow(database, 'w1');
    insertRun(database, 'w1', 'run-off', false);
    insertRun(database, 'w1', 'run-on', true);

    const usage = { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 10, cache_creation_input_tokens: 5 };

    /**
     * Ugyanaz a bemeneti sorozat, mint a `run-event-repository.spec.ts`
     * "a delta kapcsoló mindkét állásában azonos összeget ad" tesztjében:
     * két `sdk_stream_event` sor is a sorozat része, hogy a két futás
     * ténylegesen ELTÉRŐ számú `run_event` sort kapjon (58., 59. kritérium).
     */
    function feed(runId: string): void {
      okOrThrow(
        runEvents.appendSdkEvent({
          runId,
          stepRunId: null,
          message: { type: 'system', subtype: 'init', session_id: 'ses-1' },
        }),
      );
      okOrThrow(
        runEvents.appendSdkEvent({
          runId,
          stepRunId: null,
          message: { type: 'stream_event', event: { type: 'content_block_delta' } },
        }),
      );
      okOrThrow(
        runEvents.appendSdkEvent({
          runId,
          stepRunId: null,
          message: { type: 'stream_event', event: { type: 'ping' } },
        }),
      );
      okOrThrow(
        runEvents.appendSdkEvent({
          runId,
          stepRunId: null,
          message: { type: 'assistant', message: { content: [], usage } },
        }),
      );
    }

    feed('run-off');
    feed('run-on');

    const offEvents = okOrThrow(runEvents.readEventsSince('run-off', 0, 100));
    const onEvents = okOrThrow(runEvents.readEventsSince('run-on', 0, 100));
    // Bizonyíték, hogy a két futás ténylegesen eltérő számú run_event sort
    // kapott: enélkül a lenti egyezés üresen igaz volna.
    expect(offEvents).toHaveLength(2);
    expect(onEvents).toHaveLength(4);

    const tokens = { inputTokens: 321, outputTokens: 654, cacheReadInputTokens: 12, cacheCreationInputTokens: 3 };

    const offStep = create(repository, 'run-off');
    okOrThrow(repository.markStepRunning(offStep.id));
    okOrThrow(repository.markStepSucceeded(offStep.id, { tokens }));

    const onStep = create(repository, 'run-on');
    okOrThrow(repository.markStepRunning(onStep.id));
    okOrThrow(repository.markStepSucceeded(onStep.id, { tokens }));

    const offRecord = okOrThrow(repository.getStepRun(offStep.id));
    const onRecord = okOrThrow(repository.getStepRun(onStep.id));

    const offTokenColumns = {
      inputTokens: offRecord.inputTokens,
      outputTokens: offRecord.outputTokens,
      cacheReadInputTokens: offRecord.cacheReadInputTokens,
      cacheCreationInputTokens: offRecord.cacheCreationInputTokens,
    };
    const onTokenColumns = {
      inputTokens: onRecord.inputTokens,
      outputTokens: onRecord.outputTokens,
      cacheReadInputTokens: onRecord.cacheReadInputTokens,
      cacheCreationInputTokens: onRecord.cacheCreationInputTokens,
    };
    expect(offTokenColumns).toStrictEqual(onTokenColumns);
    expect(offTokenColumns).toStrictEqual(tokens);

    sqlite.close();
  });
});
