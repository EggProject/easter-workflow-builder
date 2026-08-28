/* eslint-disable unicorn/no-null -- a `WorkflowRunRecord` nullázható mezői (restartedFromRunId, startedAtMs, ...) tárolt/visszaadott `null` értéket hordoznak, nem helyőrző `undefined`-et */
import SqliteDatabase from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq, sql } from 'drizzle-orm';
import { describeError, type Outcome } from '@easter-workflow-builder/core';
import { describe, expect, it } from 'vitest';
import { migrateDatabase } from '../migration/migrate-database.ts';
import { MIGRATIONS_FOLDER } from '../migration/migrations-folder.ts';
import { workflowTable } from '../workflow-graph/workflow.ts';
import { graphSnapshotTable } from '../graph-snapshot/graph-snapshot.ts';
import { canonicalizeSnapshotDocument } from '../graph-snapshot/canonicalize-snapshot-document.ts';
import { computeSnapshotHash } from '../graph-snapshot/compute-snapshot-hash.ts';
import { GRAPH_DOCUMENT_VERSION, type GraphSnapshotDocument } from '../graph-snapshot/graph-snapshot-document.ts';
import { appSettingTable, APP_SETTING_ROW_ID } from '../app-setting/app-setting.ts';
import { runEventTable } from '../run-event/run-event.ts';
import { workflowRunTable } from './workflow-run.ts';
import {
  createWorkflowRunRepository,
  type StartRunInput,
  type WorkflowRunRecord,
  type WorkflowRunRepository,
} from './workflow-run-repository.ts';

/**
 * Ugyanaz a minta, mint a `workflow-graph/workflow-repository.spec.ts`-ben:
 * a `.spec.ts` fájl a `createWorkflowRunRepository`-t közvetlenül teszteli,
 * nem az `openDatabase` kompozíción keresztül, hogy legyen közvetlen
 * `database` hozzáférés a nyers beszúrásokhoz (korrupt adat, FK nélküli
 * eset, ütközés szimuláció).
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

function openRepository(options: { foreignKeys?: boolean } = {}): {
  sqlite: SqliteDatabase.Database;
  database: BetterSQLite3Database;
  repository: WorkflowRunRepository;
} {
  const sqlite = new SqliteDatabase(':memory:');
  // A `better-sqlite3` 13.0.3 ténylegesen bekapcsolt `foreign_keys` pragmával
  // nyit (saját mérés, nem az F-1 által hivatkozott, a puszta SQLite
  // könyvtárra vonatkozó alapértelmezés), ezért az "FK nélküli" ághoz
  // **explicit ki kell kapcsolni**, nem elég kihagyni a bekapcsolást.
  sqlite.pragma(options.foreignKeys === false ? 'foreign_keys = OFF' : 'foreign_keys = ON');
  const database = drizzle(sqlite);
  migrateDatabase(database, MIGRATIONS_FOLDER);
  const repository = createWorkflowRunRepository(database, makeTransaction(database));
  return { sqlite, database, repository };
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

function minimalDocument(workflowId: string, name: string): GraphSnapshotDocument {
  return {
    version: GRAPH_DOCUMENT_VERSION,
    sdkVersionPin: '0.0.0-test',
    workflow: { id: workflowId, name, description: null },
    nodes: [],
    edges: [],
  };
}

/**
 * Egy dokumentum, aminek az egyik `config` mezőjében egész indexű kulcsok
 * (`"9"`, `"10"`) állnak: erre a JS `OrdinaryOwnPropertyKeys` szabálya
 * (F-26) a `"9"`, `"10"`, `"a"` sorrendet adná, az RFC 8785 kanonikus alak
 * viszont `"10"`, `"9"`, `"a"` sorrendet ír elő (UTF-16 kódegység
 * szerint). Ez a dokumentum bizonyítja, hogy a `startRun` a nyers,
 * kanonikus szöveget írja be, nem a Drizzle típusos `JSON.stringify`
 * szerializálóján át (lásd a `startRun` dokumentációját).
 */
function documentWithIntegerLikeKeys(workflowId: string): GraphSnapshotDocument {
  return {
    version: GRAPH_DOCUMENT_VERSION,
    sdkVersionPin: '0.0.0-test',
    workflow: { id: workflowId, name: 'Egesz-indexu-kulcsok', description: null },
    nodes: [
      {
        id: 'node-1',
        type: 'start',
        label: 'Start',
        position: { x: 0, y: 0 },
        config: { '9': 'nine', '10': 'ten', a: 'letter-a' },
        effectiveProviderId: 'minimax',
      },
    ],
    edges: [],
  };
}

function baseStartInput(workflowId: string, document: GraphSnapshotDocument): StartRunInput {
  return { workflowId, input: { tema: 'x' }, providerId: 'minimax', graphSnapshotDocument: document };
}

/**
 * Kényelmi függvény: elindít egy futást egy adott dokumentummal, és
 * kicsomagolja az `Outcome`-ot. Ez tartja alacsonyan a beágyazási mélységet
 * (`unicorn/max-nested-calls`, max 3) a hívási helyeken, amik különben
 * `okOrThrow(repository.startRun(baseStartInput(...)))` alakban négy szintet
 * érnének el.
 */
function startWithDocument(
  repository: WorkflowRunRepository,
  workflowId: string,
  document: GraphSnapshotDocument,
  extra: Partial<StartRunInput> = {},
): WorkflowRunRecord {
  const input: StartRunInput = { ...baseStartInput(workflowId, document), ...extra };
  return okOrThrow(repository.startRun(input));
}

/**
 * Ugyanaz, de a dokumentumot a `name` argumentumból, `minimalDocument`-tel
 * építi fel - ez a leggyakoribb eset a tesztekben.
 */
function start(
  repository: WorkflowRunRepository,
  workflowId: string,
  name: string,
  extra: Partial<StartRunInput> = {},
): WorkflowRunRecord {
  return startWithDocument(repository, workflowId, minimalDocument(workflowId, name), extra);
}

describe('createWorkflowRunRepository', () => {
  describe('startRun', () => {
    it('gyökér futásnál a saját id-jára mutat, depth 0, workflow_ancestry egyelemű', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');

      const run = start(repository, 'w1', 'Doc');

      expect(run.rootRunId).toBe(run.id);
      expect(run.depth).toBe(0);
      expect(run.workflowAncestry).toStrictEqual(['w1']);
      expect(run.status).toBe('pending');
      expect(run.startedAtMs).toBeNull();
      expect(run.finishedAtMs).toBeNull();
      expect(run.errorKind).toBeNull();
      expect(run.errorMessage).toBeNull();
      expect(run.restartedFromRunId).toBeNull();
      expect(run.persistedStreamDeltas).toBe(false);

      sqlite.close();
    });

    it('ugyanabban a tranzakcióban egy run_started motor eseményt is ír a run_event táblába (T-003-21)', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');

      const run = start(repository, 'w1', 'Doc');

      const events = database.select().from(runEventTable).where(eq(runEventTable.runId, run.id)).all();
      expect(events).toHaveLength(1);
      expect(events[0]?.kind).toBe('run_started');
      expect(events[0]?.origin).toBe('engine');
      expect(events[0]?.stepRunId).toBeNull();
      expect(events[0]?.payload).toStrictEqual({ runId: run.id, workflowId: 'w1' });

      sqlite.close();
    });

    it('al-workflow hívásnál a parent kontextusból vezeti le a root_run_id, depth és workflow_ancestry mezőt', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'workflow-a');
      insertWorkflow(database, 'workflow-b');

      const root = start(repository, 'workflow-a', 'A');
      const sub = start(repository, 'workflow-b', 'B', {
        parent: { rootRunId: root.rootRunId, depth: root.depth, workflowAncestry: root.workflowAncestry },
      });

      expect(sub.rootRunId).toBe(root.id);
      expect(sub.depth).toBe(1);
      expect(sub.workflowAncestry).toStrictEqual(['workflow-a', 'workflow-b']);

      sqlite.close();
    });

    it('a restartedFromRunId mezőt a bemenetből veszi át, alapból null', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');

      const original = start(repository, 'w1', 'V1');
      const restarted = start(repository, 'w1', 'V1', { restartedFromRunId: original.id });

      expect(restarted.restartedFromRunId).toBe(original.id);

      sqlite.close();
    });

    it('a globális persist_stream_deltas beállítást fagyasztja be indításkor; a későbbi átállítás a már elindult futást nem érinti (38., 57. kritérium)', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');

      // Nincs még app_setting sor, tehát a séma szintű hamis alapérték él
      // (4.13 szekció, "A sor életciklusa").
      const first = start(repository, 'w1', 'Elso');
      expect(first.persistedStreamDeltas).toBe(false);

      // Globális átállítás igazra, közvetlen upsert az app_setting táblára:
      // ez a teszt a WorkflowRunRepository-t önmagában, AppSettingRepository
      // nélkül teszteli, ugyanúgy, ahogy a korrupt adat teszteknél is a nyers
      // `database`-t használja.
      database
        .insert(appSettingTable)
        .values({ id: APP_SETTING_ROW_ID, persistStreamDeltas: true, updatedAtMs: new Date(0) })
        .onConflictDoUpdate({
          target: appSettingTable.id,
          set: { persistStreamDeltas: true, updatedAtMs: new Date(0) },
        })
        .run();

      const second = start(repository, 'w1', 'Masodik');
      expect(second.persistedStreamDeltas).toBe(true);

      // Az első futás visszaolvasva továbbra is a saját, indításkor
      // befagyasztott értékét mutatja, nem a globális beállítás új állását
      // (SPEC-003 6.6 szekció, "Futás közben nem változhat").
      const rereadFirst = okOrThrow(repository.getRun(first.id));
      expect(rereadFirst.persistedStreamDeltas).toBe(false);

      sqlite.close();
    });

    it('ugyanannak a változatlan gráfnak N futása pontosan egy graph_snapshot sort hoz létre (50. kritérium)', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');

      const runA = start(repository, 'w1', 'Same');
      const runB = start(repository, 'w1', 'Same');
      const runC = start(repository, 'w1', 'Same');

      expect(runA.graphSnapshotHash).toBe(runB.graphSnapshotHash);
      expect(runB.graphSnapshotHash).toBe(runC.graphSnapshotHash);
      expect(database.select().from(graphSnapshotTable).all()).toHaveLength(1);

      sqlite.close();
    });

    it('a beszúrt document oszlop bájtra a kanonikus szöveg, crypto.hash(document) = hash (45. kritérium)', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      const document = documentWithIntegerLikeKeys('w1');

      const expectedCanonicalText = okOrThrow(canonicalizeSnapshotDocument(document));
      const expectedHash = computeSnapshotHash(expectedCanonicalText);

      // Bizonyíték, hogy a teszt nem üres: a naiv, Drizzle JSON módon át
      // menő írás (JSON.parse majd JSON.stringify) MÁS bájtsort adna, mert
      // a JS engine az egész indexű kulcsokat mindig növekvő számsorrendben
      // írná ki, az RFC 8785 viszont UTF-16 sorrendet ír elő (F-26).
      const parsedForRoundTrip: unknown = JSON.parse(expectedCanonicalText);
      const naiveRoundTrip = JSON.stringify(parsedForRoundTrip);
      expect(naiveRoundTrip).not.toBe(expectedCanonicalText);

      const run = startWithDocument(repository, 'w1', document);
      expect(run.graphSnapshotHash).toBe(expectedHash);

      const storedRow = database.get<{ document: string }>(
        sql`SELECT document FROM graph_snapshot WHERE hash = ${expectedHash}`,
      );
      // A `database.get<T>()` deklarált típusa (lásd `workflow-run-repository.ts`
      // dokumentációját) nem tartalmaz `undefined`-et, ezért itt nincs
      // opcionális lánc: a `startWithDocument` fenti sikeres hívása után a
      // sornak léteznie kell.
      expect(storedRow.document).toBe(expectedCanonicalText);
      expect(computeSnapshotHash(storedRow.document)).toBe(expectedHash);

      sqlite.close();
    });

    it('non_canonicalizable_value hibaágat ad, ha a dokumentum nem kanonizálható (pl. NaN a configban)', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      const document = minimalDocument('w1', 'Rossz');
      const withNaN: GraphSnapshotDocument = {
        ...document,
        nodes: [
          {
            id: 'node-1',
            type: 'start',
            label: 'Start',
            position: { x: 0, y: 0 },
            config: { limit: NaN },
            effectiveProviderId: 'minimax',
          },
        ],
      };

      const outcome = repository.startRun(baseStartInput('w1', withNaN));
      expect(errorOrThrow(outcome)).toContain('non_canonicalizable_value');

      sqlite.close();
    });

    it('graph_snapshot_hash_collision hibaágat ad, ha a lenyomathoz már eltérő tartalmú sor tartozik', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      const document = minimalDocument('w1', 'Utkozes');
      const canonicalText = okOrThrow(canonicalizeSnapshotDocument(document));
      const hash = computeSnapshotHash(canonicalText);

      // Szimulált ütközés: a lenyomathoz már tartozik sor, de MÁS tartalommal.
      database
        .insert(graphSnapshotTable)
        .values({ hash, documentVersion: 1, document: { note: 'mismatched-document' }, firstCapturedAtMs: new Date(0) })
        .run();

      const outcome = repository.startRun(baseStartInput('w1', document));
      expect(errorOrThrow(outcome)).toContain('graph_snapshot_hash_collision');
      // A tranzakció visszagördült, nem íródott workflow_run sor.
      expect(database.select().from(workflowRunTable).all()).toStrictEqual([]);

      sqlite.close();
    });
  });

  describe('getRun / listRuns / listRunsForWorkflow', () => {
    it('not_found hibaágat ad ismeretlen runId-ra', () => {
      const { sqlite, repository } = openRepository();
      expect(errorOrThrow(repository.getRun('nincs-ilyen'))).toContain('not_found');
      sqlite.close();
    });

    it('getRun visszaadja a startRun által létrehozott sort', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      const created = start(repository, 'w1', 'X');

      const fetched = okOrThrow(repository.getRun(created.id));
      expect(fetched).toStrictEqual(created);

      sqlite.close();
    });

    it('listRuns és listRunsForWorkflow created_at_ms szerint csökkenő sorrendben ad listát', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      insertWorkflow(database, 'w2');

      const first = start(repository, 'w1', '1');
      database
        .update(workflowRunTable)
        .set({ createdAtMs: new Date(1000) })
        .where(eq(workflowRunTable.id, first.id))
        .run();
      const second = start(repository, 'w1', '2');
      database
        .update(workflowRunTable)
        .set({ createdAtMs: new Date(2000) })
        .where(eq(workflowRunTable.id, second.id))
        .run();
      const other = start(repository, 'w2', '3');
      database
        .update(workflowRunTable)
        .set({ createdAtMs: new Date(3000) })
        .where(eq(workflowRunTable.id, other.id))
        .run();

      const all = okOrThrow(repository.listRuns());
      expect(all.map((run) => run.id)).toStrictEqual([other.id, second.id, first.id]);

      const forW1 = okOrThrow(repository.listRunsForWorkflow('w1'));
      expect(forW1.map((run) => run.id)).toStrictEqual([second.id, first.id]);

      sqlite.close();
    });

    it('üres listát ad, ha egy workflow-nak nincs futása', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      expect(okOrThrow(repository.listRunsForWorkflow('w1'))).toStrictEqual([]);
      sqlite.close();
    });

    it('invalid_provider_id hibaágat ad, ha a tárolt provider_id nem érvényes ProviderId (korrupt adat)', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      const document = minimalDocument('w1', 'Korrupt');
      const canonicalText = okOrThrow(canonicalizeSnapshotDocument(document));
      const hash = computeSnapshotHash(canonicalText);
      database
        .insert(graphSnapshotTable)
        .values({ hash, documentVersion: 1, document, firstCapturedAtMs: new Date(0) })
        .run();
      database
        .insert(workflowRunTable)
        .values({
          id: 'corrupt-run',
          workflowId: 'w1',
          status: 'pending',
          input: {},
          providerId: 'nem-letezo-provider',
          rootRunId: 'corrupt-run',
          depth: 0,
          workflowAncestry: ['w1'],
          graphSnapshotHash: hash,
          persistedStreamDeltas: false,
          createdAtMs: new Date(0),
        })
        .run();

      expect(errorOrThrow(repository.getRun('corrupt-run'))).toContain('invalid_provider_id');
      expect(errorOrThrow(repository.listRuns())).toContain('invalid_provider_id');

      sqlite.close();
    });

    it('invalid_run_status hibaágat ad, ha a tárolt status nem érvényes RunStatus (korrupt adat)', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      const document = minimalDocument('w1', 'Korrupt2');
      const canonicalText = okOrThrow(canonicalizeSnapshotDocument(document));
      const hash = computeSnapshotHash(canonicalText);
      database
        .insert(graphSnapshotTable)
        .values({ hash, documentVersion: 1, document, firstCapturedAtMs: new Date(0) })
        .run();
      database
        .insert(workflowRunTable)
        .values({
          id: 'corrupt-run-2',
          workflowId: 'w1',
          status: 'nem-letezo-status',
          input: {},
          providerId: 'minimax',
          rootRunId: 'corrupt-run-2',
          depth: 0,
          workflowAncestry: ['w1'],
          graphSnapshotHash: hash,
          persistedStreamDeltas: false,
          createdAtMs: new Date(0),
        })
        .run();

      expect(errorOrThrow(repository.getRun('corrupt-run-2'))).toContain('invalid_run_status');

      sqlite.close();
    });

    it('corrupt_workflow_ancestry hibaágat ad, ha a tárolt workflow_ancestry nem szövegtömb (korrupt adat)', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      const document = minimalDocument('w1', 'Korrupt3');
      const canonicalText = okOrThrow(canonicalizeSnapshotDocument(document));
      const hash = computeSnapshotHash(canonicalText);
      database
        .insert(graphSnapshotTable)
        .values({ hash, documentVersion: 1, document, firstCapturedAtMs: new Date(0) })
        .run();
      database
        .insert(workflowRunTable)
        .values({
          id: 'corrupt-run-3',
          workflowId: 'w1',
          status: 'pending',
          input: {},
          providerId: 'minimax',
          rootRunId: 'corrupt-run-3',
          depth: 0,
          workflowAncestry: { not: 'an-array' },
          graphSnapshotHash: hash,
          persistedStreamDeltas: false,
          createdAtMs: new Date(0),
        })
        .run();

      expect(errorOrThrow(repository.getRun('corrupt-run-3'))).toContain('corrupt_workflow_ancestry');

      sqlite.close();
    });
  });

  describe('állapotváltók (compare and set)', () => {
    it('markRunRunning: pending -> running, beállítja a startedAtMs mezőt', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      const run = start(repository, 'w1', 'Run');

      const running = okOrThrow(repository.markRunRunning(run.id));
      expect(running.status).toBe('running');
      expect(running.startedAtMs).toBeInstanceOf(Date);

      sqlite.close();
    });

    it('markRunRunning illegal_status_transition hibaágat ad, ha a futás nem pending (pl. már running)', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      const run = start(repository, 'w1', 'Run2');
      okOrThrow(repository.markRunRunning(run.id));

      expect(errorOrThrow(repository.markRunRunning(run.id))).toContain('illegal_status_transition');

      sqlite.close();
    });

    it('markRunRunning illegal_status_transition hibaágat ad ismeretlen runId-ra', () => {
      const { sqlite, repository } = openRepository();
      expect(errorOrThrow(repository.markRunRunning('nincs-ilyen'))).toContain('illegal_status_transition');
      sqlite.close();
    });

    it('markRunSucceeded: running -> succeeded, beállítja a finishedAtMs mezőt', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      const run = start(repository, 'w1', 'Succ');
      okOrThrow(repository.markRunRunning(run.id));

      const succeeded = okOrThrow(repository.markRunSucceeded(run.id));
      expect(succeeded.status).toBe('succeeded');
      expect(succeeded.finishedAtMs).toBeInstanceOf(Date);

      sqlite.close();
    });

    it('markRunSucceeded illegal_status_transition hibaágat ad pending állapotból (running kihagyva)', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      const run = start(repository, 'w1', 'Succ2');

      expect(errorOrThrow(repository.markRunSucceeded(run.id))).toContain('illegal_status_transition');

      sqlite.close();
    });

    it('markRunFailed: running -> failed, beállítja a finishedAtMs, errorKind és errorMessage mezőt', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      const run = start(repository, 'w1', 'Fail');
      okOrThrow(repository.markRunRunning(run.id));

      const failed = okOrThrow(repository.markRunFailed(run.id, 'timeout', 'A futás túllépte az időkeretet.'));
      expect(failed.status).toBe('failed');
      expect(failed.finishedAtMs).toBeInstanceOf(Date);
      expect(failed.errorKind).toBe('timeout');
      expect(failed.errorMessage).toBe('A futás túllépte az időkeretet.');

      sqlite.close();
    });

    it('markRunFailed illegal_status_transition hibaágat ad terminális állapotból', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      const run = start(repository, 'w1', 'Fail2');
      okOrThrow(repository.markRunRunning(run.id));
      okOrThrow(repository.markRunSucceeded(run.id));

      expect(errorOrThrow(repository.markRunFailed(run.id, 'timeout', 'x'))).toContain('illegal_status_transition');

      sqlite.close();
    });

    it('markRunCancelled: pending -> cancelled és running -> cancelled is engedett, beállítja a finishedAtMs mezőt', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');

      const runFromPending = start(repository, 'w1', 'Canc1');
      const cancelledFromPending = okOrThrow(repository.markRunCancelled(runFromPending.id));
      expect(cancelledFromPending.status).toBe('cancelled');
      expect(cancelledFromPending.finishedAtMs).toBeInstanceOf(Date);

      const runFromRunning = start(repository, 'w1', 'Canc2');
      okOrThrow(repository.markRunRunning(runFromRunning.id));
      const cancelledFromRunning = okOrThrow(repository.markRunCancelled(runFromRunning.id));
      expect(cancelledFromRunning.status).toBe('cancelled');

      sqlite.close();
    });

    it('markRunCancelled illegal_status_transition hibaágat ad terminális állapotból', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      const run = start(repository, 'w1', 'Canc3');
      okOrThrow(repository.markRunRunning(run.id));
      okOrThrow(repository.markRunSucceeded(run.id));

      expect(errorOrThrow(repository.markRunCancelled(run.id))).toContain('illegal_status_transition');

      sqlite.close();
    });

    it('markRunInterrupted: pending -> interrupted és running -> interrupted is engedett, beállítja a finishedAtMs mezőt', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');

      const runFromPending = start(repository, 'w1', 'Int1');
      const interruptedFromPending = okOrThrow(repository.markRunInterrupted(runFromPending.id));
      expect(interruptedFromPending.status).toBe('interrupted');
      expect(interruptedFromPending.finishedAtMs).toBeInstanceOf(Date);

      const runFromRunning = start(repository, 'w1', 'Int2');
      okOrThrow(repository.markRunRunning(runFromRunning.id));
      const interruptedFromRunning = okOrThrow(repository.markRunInterrupted(runFromRunning.id));
      expect(interruptedFromRunning.status).toBe('interrupted');

      sqlite.close();
    });

    it('markRunInterrupted illegal_status_transition hibaágat ad terminális állapotból', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      const run = start(repository, 'w1', 'Int3');
      okOrThrow(repository.markRunRunning(run.id));
      okOrThrow(repository.markRunSucceeded(run.id));

      expect(errorOrThrow(repository.markRunInterrupted(run.id))).toContain('illegal_status_transition');

      sqlite.close();
    });
  });

  describe('readSnapshot', () => {
    it('a futáshoz tartozó gráf pillanatképet adja vissza', () => {
      const { sqlite, database, repository } = openRepository();
      insertWorkflow(database, 'w1');
      const document = minimalDocument('w1', 'Snap');
      const run = startWithDocument(repository, 'w1', document);

      const snapshot = okOrThrow(repository.readSnapshot(run.id));
      expect(snapshot).toStrictEqual(document);

      sqlite.close();
    });

    it('not_found hibaágat ad ismeretlen runId-ra', () => {
      const { sqlite, repository } = openRepository();
      expect(errorOrThrow(repository.readSnapshot('nincs-ilyen'))).toContain('not_found');
      sqlite.close();
    });

    it('not_found hibaágat ad, ha a hivatkozott graph_snapshot sor hiányzik (megsérült, FK nélkül létrejött állapot)', () => {
      const { sqlite, database, repository } = openRepository({ foreignKeys: false });
      insertWorkflow(database, 'w1');
      const run = start(repository, 'w1', 'Dangling');

      // FK pragma nélkül a törlés lefut, holott egy futás még hivatkozik rá:
      // ezt csak egy megsérült, rendellenes állapot szimulálására használjuk.
      database.delete(graphSnapshotTable).where(eq(graphSnapshotTable.hash, run.graphSnapshotHash)).run();

      expect(errorOrThrow(repository.readSnapshot(run.id))).toContain('not_found');

      sqlite.close();
    });
  });
});
