/* eslint-disable unicorn/no-null -- a HumanApprovalRecord/DecideApprovalInput nullázható mezői (decision, decidedAtMs) tárolt/visszaadott `null` értéket hordoznak, nem helyőrző `undefined`-et */
import SqliteDatabase from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { describeError, type Outcome } from '@easter-workflow-builder/core';
import { describe, expect, it } from 'vitest';
import { migrateDatabase } from '../migration/migrate-database.ts';
import { MIGRATIONS_FOLDER } from '../migration/migrations-folder.ts';
import { workflowTable } from '../workflow-graph/workflow.ts';
import { graphSnapshotTable } from '../graph-snapshot/stored-snapshot/graph-snapshot.ts';
import { computeSnapshotHash } from '../graph-snapshot/snapshot-hash/compute-snapshot-hash.ts';
import { workflowRunTable } from '../workflow-run/workflow-run.ts';
import { stepRunTable } from '../step-run/step-run.ts';
import { createStepRunRepository, type StepRunRepository } from '../step-run/step-run-repository.ts';
import { humanApprovalTable } from './human-approval.ts';
import {
  createHumanApprovalRepository,
  type HumanApprovalRepository,
  type RequestApprovalInput,
} from './human-approval-repository.ts';

/**
 * Ugyanaz a minta, mint a `step-run/step-run-repository.spec.ts`-ben: a
 * `.spec.ts` fájl a `createHumanApprovalRepository`-t közvetlenül teszteli,
 * nem az `openDatabase` kompozíción keresztül, hogy legyen közvetlen
 * `database` hozzáférés a nyers beszúrásokhoz/módosításokhoz (korrupt és
 * szimulált versenyhelyzet adat).
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
  stepRuns: StepRunRepository;
  repository: HumanApprovalRepository;
} {
  const sqlite = new SqliteDatabase(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const database = drizzle(sqlite);
  migrateDatabase(database, MIGRATIONS_FOLDER);
  const transaction = makeTransaction(database);
  const stepRuns = createStepRunRepository(database, transaction);
  const repository = createHumanApprovalRepository(database, transaction, stepRuns);
  return { sqlite, database, stepRuns, repository };
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
 * Beszúr egy `graph_snapshot` és egy rá hivatkozó `workflow_run` sort. A
 * `human_approval.run_id` a `workflow_run` táblára mutat (SPEC-003 4.12),
 * ezért minden teszthez kell egy létező futás.
 */
function insertRun(database: BetterSQLite3Database, workflowId: string, runId: string): void {
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
      persistedStreamDeltas: false,
      createdAtMs: new Date(0),
    })
    .run();
}

/**
 * Létrehoz egy `human_approval` node típusú lépés futást, és `running`
 * állapotba viszi: a `requestApproval`/`decideApproval` minden érvényes
 * átmenete `running`/`waiting_approval` kiindulási állapotot igényel
 * (SPEC-003 7.2 táblázat).
 */
function createRunningStep(stepRuns: StepRunRepository, runId: string, nodeId = 'node-approval'): string {
  const step = okOrThrow(
    stepRuns.createStepRun({
      runId,
      nodeId,
      nodeType: 'human_approval',
      parentStepRunId: null,
      providerId: 'minimax',
      modelId: null,
      sessionMode: null,
      structuredOutputStrategy: null,
      subWorkflowRunId: null,
    }),
  );
  okOrThrow(stepRuns.markStepRunning(step.id));
  return step.id;
}

function baseRequestInput(runId: string, stepRunId: string): RequestApprovalInput {
  return {
    runId,
    stepRunId,
    title: 'Jóváhagyás szükséges',
    body: 'A lépés a folytatáshoz emberi jóváhagyást igényel.',
    payload: { previousStepOutput: { ok: true } },
  };
}

describe('createHumanApprovalRepository', () => {
  describe('requestApproval', () => {
    it('beszúrja a sort decision: null értékkel, és a lépés futást waiting_approval állapotba viszi', () => {
      const { sqlite, database, stepRuns, repository } = openRepository();
      insertWorkflow(database, 'w1');
      insertRun(database, 'w1', 'run-1');
      const stepRunId = createRunningStep(stepRuns, 'run-1');

      const approval = okOrThrow(repository.requestApproval(baseRequestInput('run-1', stepRunId)));

      expect(approval.decision).toBeNull();
      expect(approval.decidedAtMs).toBeNull();
      expect(approval.title).toBe('Jóváhagyás szükséges');
      expect(approval.payload).toStrictEqual({ previousStepOutput: { ok: true } });
      expect(approval.requestedAtMs).toBeInstanceOf(Date);

      const step = okOrThrow(stepRuns.getStepRun(stepRunId));
      expect(step.status).toBe('waiting_approval');

      sqlite.close();
    });

    it('illegal_status_transition hibaágat ad, ha a lépés futás nem running állapotú, és a human_approval sor nem marad meg (visszagördül)', () => {
      const { sqlite, database, stepRuns, repository } = openRepository();
      insertWorkflow(database, 'w1');
      insertRun(database, 'w1', 'run-1');
      // Szándékosan NEM hívjuk a markStepRunning-ot: a lépés futás pending
      // marad, a running -> waiting_approval átmenet emiatt hibázik.
      const step = okOrThrow(
        stepRuns.createStepRun({
          runId: 'run-1',
          nodeId: 'node-approval',
          nodeType: 'human_approval',
          parentStepRunId: null,
          providerId: 'minimax',
          modelId: null,
          sessionMode: null,
          structuredOutputStrategy: null,
          subWorkflowRunId: null,
        }),
      );

      const outcome = repository.requestApproval(baseRequestInput('run-1', step.id));
      expect(errorOrThrow(outcome)).toContain('illegal_status_transition');

      expect(errorOrThrow(repository.getApprovalForStep(step.id))).toContain('not_found');
      expect(database.select().from(humanApprovalTable).all()).toStrictEqual([]);

      sqlite.close();
    });
  });

  describe('decideApproval', () => {
    it('approved: a decision és a decidedAtMs íródik, a lépés futás succeeded állapotba kerül', () => {
      const { sqlite, database, stepRuns, repository } = openRepository();
      insertWorkflow(database, 'w1');
      insertRun(database, 'w1', 'run-1');
      const stepRunId = createRunningStep(stepRuns, 'run-1');
      okOrThrow(repository.requestApproval(baseRequestInput('run-1', stepRunId)));

      const decided = okOrThrow(repository.decideApproval({ stepRunId, decision: 'approved' }));
      expect(decided.decision).toBe('approved');
      expect(decided.decidedAtMs).toBeInstanceOf(Date);

      const step = okOrThrow(stepRuns.getStepRun(stepRunId));
      expect(step.status).toBe('succeeded');

      sqlite.close();
    });

    it('rejected: a lépés futás rejected állapotba kerül, nem failed', () => {
      const { sqlite, database, stepRuns, repository } = openRepository();
      insertWorkflow(database, 'w1');
      insertRun(database, 'w1', 'run-1');
      const stepRunId = createRunningStep(stepRuns, 'run-1');
      okOrThrow(repository.requestApproval(baseRequestInput('run-1', stepRunId)));

      const decided = okOrThrow(repository.decideApproval({ stepRunId, decision: 'rejected' }));
      expect(decided.decision).toBe('rejected');

      const step = okOrThrow(stepRuns.getStepRun(stepRunId));
      expect(step.status).toBe('rejected');

      sqlite.close();
    });

    it('not_found hibaágat ad, ha a step_run_id-hoz nincs jóváhagyási kérés', () => {
      const { sqlite, repository } = openRepository();
      const outcome = repository.decideApproval({ stepRunId: 'nincs-ilyen', decision: 'approved' });
      expect(errorOrThrow(outcome)).toContain('not_found');
      sqlite.close();
    });

    it('already_decided hibaágat ad, ha a jóváhagyás már el van döntve', () => {
      const { sqlite, database, stepRuns, repository } = openRepository();
      insertWorkflow(database, 'w1');
      insertRun(database, 'w1', 'run-1');
      const stepRunId = createRunningStep(stepRuns, 'run-1');
      okOrThrow(repository.requestApproval(baseRequestInput('run-1', stepRunId)));
      okOrThrow(repository.decideApproval({ stepRunId, decision: 'approved' }));

      const outcome = repository.decideApproval({ stepRunId, decision: 'rejected' });
      expect(errorOrThrow(outcome)).toContain('already_decided');

      // Az első döntés érintetlen maradt.
      const approval = okOrThrow(repository.getApprovalForStep(stepRunId));
      expect(approval.decision).toBe('approved');

      sqlite.close();
    });

    it('ha a lépés állapotváltás hibázik, a human_approval.decision írása is visszagördül (tranzakciós atomicitás)', () => {
      const { sqlite, database, stepRuns, repository } = openRepository();
      insertWorkflow(database, 'w1');
      insertRun(database, 'w1', 'run-1');
      const stepRunId = createRunningStep(stepRuns, 'run-1');
      okOrThrow(repository.requestApproval(baseRequestInput('run-1', stepRunId)));

      // A lépés futást közvetlenül, a repository megkerülésével egy olyan
      // állapotba visszük ("cancelled"), ahonnan a canTransitionStepRunStatus
      // szerint a waiting_approval -> succeeded átmenet már nem engedett: a
      // human_approval sor eközben változatlanul decision: null marad.
      database.update(stepRunTable).set({ status: 'cancelled' }).where(eq(stepRunTable.id, stepRunId)).run();

      const outcome = repository.decideApproval({ stepRunId, decision: 'approved' });
      expect(errorOrThrow(outcome)).toContain('illegal_status_transition');

      // A human_approval.decision NEM íródott be: a teljes tranzakció
      // visszagördült, annak ellenére, hogy az UPDATE önmagában sikeres lett
      // volna.
      const row = database.select().from(humanApprovalTable).where(eq(humanApprovalTable.stepRunId, stepRunId)).get();
      expect(row?.decision).toBeNull();
      expect(row?.decidedAtMs).toBeNull();

      // A step_run státusza is változatlanul "cancelled" maradt.
      const step = okOrThrow(stepRuns.getStepRun(stepRunId));
      expect(step.status).toBe('cancelled');

      sqlite.close();
    });
  });

  describe('getApprovalForStep', () => {
    it('not_found hibaágat ad ismeretlen stepRunId-ra', () => {
      const { sqlite, repository } = openRepository();
      expect(errorOrThrow(repository.getApprovalForStep('nincs-ilyen'))).toContain('not_found');
      sqlite.close();
    });

    it('visszaadja a requestApproval által létrehozott sort', () => {
      const { sqlite, database, stepRuns, repository } = openRepository();
      insertWorkflow(database, 'w1');
      insertRun(database, 'w1', 'run-1');
      const stepRunId = createRunningStep(stepRuns, 'run-1');
      const created = okOrThrow(repository.requestApproval(baseRequestInput('run-1', stepRunId)));

      const fetched = okOrThrow(repository.getApprovalForStep(stepRunId));
      expect(fetched).toStrictEqual(created);

      sqlite.close();
    });

    it('invalid_approval_decision hibaágat ad, ha a tárolt decision nem érvényes ApprovalDecision (korrupt adat)', () => {
      const { sqlite, database, stepRuns } = openRepository();
      insertWorkflow(database, 'w1');
      insertRun(database, 'w1', 'run-1');
      const stepRunId = createRunningStep(stepRuns, 'run-1');
      database
        .insert(humanApprovalTable)
        .values({
          id: 'corrupt-approval',
          runId: 'run-1',
          stepRunId,
          title: 'Jóváhagyás',
          body: 'Jóváhagyási kérés.',
          payload: {},
          decision: 'nem-letezo-dontes',
          requestedAtMs: new Date(0),
        })
        .run();

      const transaction = makeTransaction(database);
      const repositoryWithCorruptRow = createHumanApprovalRepository(database, transaction, stepRuns);
      expect(errorOrThrow(repositoryWithCorruptRow.getApprovalForStep(stepRunId))).toContain(
        'invalid_approval_decision',
      );

      sqlite.close();
    });
  });

  describe('listPendingApprovals', () => {
    it('csak a decision IS NULL sorokat adja, requested_at_ms szerint növekvő sorrendben', () => {
      const { sqlite, database, stepRuns, repository } = openRepository();
      insertWorkflow(database, 'w1');
      insertRun(database, 'w1', 'run-1');
      insertRun(database, 'w1', 'run-2');

      const step1 = createRunningStep(stepRuns, 'run-1', 'node-a');
      okOrThrow(repository.requestApproval(baseRequestInput('run-1', step1)));
      database
        .update(humanApprovalTable)
        .set({ requestedAtMs: new Date(3000) })
        .where(eq(humanApprovalTable.stepRunId, step1))
        .run();

      const step2 = createRunningStep(stepRuns, 'run-2', 'node-b');
      okOrThrow(repository.requestApproval(baseRequestInput('run-2', step2)));
      database
        .update(humanApprovalTable)
        .set({ requestedAtMs: new Date(1000) })
        .where(eq(humanApprovalTable.stepRunId, step2))
        .run();

      // Egy harmadik, már eldöntött jóváhagyás: nem szerepelhet a listában.
      const step3 = createRunningStep(stepRuns, 'run-1', 'node-c');
      okOrThrow(repository.requestApproval(baseRequestInput('run-1', step3)));
      okOrThrow(repository.decideApproval({ stepRunId: step3, decision: 'approved' }));

      const pending = okOrThrow(repository.listPendingApprovals());
      expect(pending.map((approval) => approval.stepRunId)).toStrictEqual([step2, step1]);
      expect(pending.every((approval) => approval.decision === null)).toBe(true);

      sqlite.close();
    });

    it('üres listát ad, ha nincs függő jóváhagyás', () => {
      const { sqlite, repository } = openRepository();
      expect(okOrThrow(repository.listPendingApprovals())).toStrictEqual([]);
      sqlite.close();
    });
  });
});
