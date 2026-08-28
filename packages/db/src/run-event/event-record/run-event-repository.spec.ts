/* eslint-disable unicorn/no-null -- a `RunEventRecord` nullázható mezői (stepRunId, sdkUuid, ...) tárolt/visszaadott `null` értéket hordoznak, nem helyőrző `undefined`-et */
import SqliteDatabase from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { describeError, type Outcome } from '@easter-workflow-builder/core';
import { migrateDatabase } from '../../migration/migrate-database.ts';
import { MIGRATIONS_FOLDER } from '../../migration/migrations-folder.ts';
import { workflowTable } from '../../workflow-graph/workflow/workflow.ts';
import { graphSnapshotTable } from '../../graph-snapshot/stored-snapshot/graph-snapshot.ts';
import { computeSnapshotHash } from '../../graph-snapshot/snapshot-hash/compute-snapshot-hash.ts';
import { workflowRunTable } from '../../workflow-run/workflow-run.ts';
import { stepRunTable } from '../../step-run/step-run.ts';
import { runEventTable } from './run-event.ts';
import type { RunEventKind } from '../event-kind/run-event-kind.ts';
import {
  createRunEventRepository,
  type AppendEngineEventInput,
  type AppendSdkEventInput,
  type EngineRunEventKind,
  type RunEventRepository,
} from './run-event-repository.ts';

/**
 * Ugyanaz a minta, mint a `workflow-run-repository.spec.ts`-ben: a
 * `.spec.ts` fájl a `createRunEventRepository`-t közvetlenül teszteli, nem az
 * `openDatabase` kompozíción keresztül, hogy legyen közvetlen `database`
 * hozzáférés a nyers előfeltétel-beszúrásokhoz és a korrupt adat tesztekhez.
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
  repository: RunEventRepository;
} {
  const sqlite = new SqliteDatabase(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const database = drizzle(sqlite);
  migrateDatabase(database, MIGRATIONS_FOLDER);
  const repository = createRunEventRepository(database, makeTransaction(database));
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

/**
 * Egy teljes futáshoz tartozó előfeltétel: workflow, pillanatkép, futás. A
 * `persistedStreamDeltas` paraméter adja a 6.6 szekció befagyasztott
 * kapcsolóját - ez a teszt réteg közvetlenül a `workflow_run` sorba írja,
 * mert a `RunEventRepository` maga nem indít futást (az a
 * `WorkflowRunRepository.startRun` felelőssége).
 */
function seedRun(
  database: BetterSQLite3Database,
  seed: { workflowId: string; runId: string; persistedStreamDeltas?: boolean },
): void {
  database
    .insert(workflowTable)
    .values({ id: seed.workflowId, name: seed.workflowId, createdAtMs: new Date(0), updatedAtMs: new Date(0) })
    .run();
  const document = { version: 1, workflow: { id: seed.workflowId } };
  const hash = computeSnapshotHash(`${seed.workflowId}:${JSON.stringify(document)}`);
  database
    .insert(graphSnapshotTable)
    .values({ hash, documentVersion: 1, document, firstCapturedAtMs: new Date(0) })
    .run();
  database
    .insert(workflowRunTable)
    .values({
      id: seed.runId,
      workflowId: seed.workflowId,
      status: 'pending',
      input: {},
      providerId: 'minimax',
      rootRunId: seed.runId,
      depth: 0,
      workflowAncestry: [seed.workflowId],
      graphSnapshotHash: hash,
      persistedStreamDeltas: seed.persistedStreamDeltas ?? false,
      createdAtMs: new Date(0),
    })
    .run();
}

function sdkInput(runId: string, message: unknown): AppendSdkEventInput {
  return { runId, stepRunId: null, message };
}

function engineInput(runId: string, extra: Partial<AppendEngineEventInput> = {}): AppendEngineEventInput {
  return { runId, stepRunId: null, kind: 'run_started', payload: { runId }, ...extra };
}

const usage = {
  input_tokens: 100,
  output_tokens: 50,
  cache_read_input_tokens: 10,
  cache_creation_input_tokens: 5,
};

describe('createRunEventRepository', () => {
  describe('appendSdkEvent', () => {
    it('written: a nyers SDK üzenetet normalizálva szúrja be, a payload a teljes boríték', () => {
      const { sqlite, database, repository } = openRepository();
      seedRun(database, { workflowId: 'w1', runId: 'run-1' });

      const message = {
        type: 'assistant',
        session_id: 'ses-1',
        uuid: 'uuid-1',
        message: {
          content: [{ type: 'tool_use', id: 'toolu_1', name: 'web_search', input: {} }],
          usage,
        },
      };
      const outcome = okOrThrow(repository.appendSdkEvent(sdkInput('run-1', message)));
      expect(outcome.status).toBe('written');
      if (outcome.status !== 'written') {
        throw new Error('written eredményt vártunk');
      }

      const row = database.select().from(runEventTable).where(eq(runEventTable.id, outcome.eventId)).get();
      expect(row?.origin).toBe('sdk');
      expect(row?.kind).toBe('sdk_assistant');
      expect(row?.sdkMessageType).toBe('assistant');
      expect(row?.sdkSessionId).toBe('ses-1');
      expect(row?.sdkUuid).toBe('uuid-1');
      expect(row?.toolName).toBe('web_search');
      expect(row?.toolUseId).toBe('toolu_1');
      expect(row?.inputTokens).toBe(100);
      expect(row?.outputTokens).toBe(50);
      expect(row?.cacheReadInputTokens).toBe(10);
      expect(row?.cacheCreationInputTokens).toBe(5);
      expect(row?.payload).toStrictEqual(message);

      sqlite.close();
    });

    it('a stepRunId a bemenetből kerül a sorba', () => {
      const { sqlite, database, repository } = openRepository();
      seedRun(database, { workflowId: 'w1', runId: 'run-1' });
      database
        .insert(runEventTable)
        .values({ runId: 'run-1', origin: 'engine', kind: 'run_started', occurredAtMs: new Date(0), payload: {} })
        .run();
      // A step_run FK-ja miatt kell egy valódi step_run sor is.
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

      const outcome = okOrThrow(
        repository.appendSdkEvent({ runId: 'run-1', stepRunId: 'step-1', message: { type: 'user', message: {} } }),
      );
      if (outcome.status !== 'written') {
        throw new Error('written eredményt vártunk');
      }
      const row = database.select().from(runEventTable).where(eq(runEventTable.id, outcome.eventId)).get();
      expect(row?.stepRunId).toBe('step-1');

      sqlite.close();
    });

    it('skipped: sdk_stream_event kikapcsolt persisted_stream_deltas mellett nem ír sort (58., 59. kritérium)', () => {
      const { sqlite, database, repository } = openRepository();
      seedRun(database, { workflowId: 'w1', runId: 'run-1', persistedStreamDeltas: false });

      const outcome = okOrThrow(
        repository.appendSdkEvent(sdkInput('run-1', { type: 'stream_event', event: { type: 'ping' } })),
      );
      expect(outcome).toStrictEqual({ status: 'skipped' });
      expect(database.select().from(runEventTable).all()).toStrictEqual([]);

      sqlite.close();
    });

    it('written: sdk_stream_event bekapcsolt persisted_stream_deltas mellett ír sort (58. kritérium)', () => {
      const { sqlite, database, repository } = openRepository();
      seedRun(database, { workflowId: 'w1', runId: 'run-1', persistedStreamDeltas: true });

      const outcome = okOrThrow(
        repository.appendSdkEvent(sdkInput('run-1', { type: 'stream_event', event: { type: 'ping' } })),
      );
      expect(outcome.status).toBe('written');
      expect(database.select().from(runEventTable).all()).toHaveLength(1);

      sqlite.close();
    });

    it('a szűrés a futás sorából dolgozik, nem a hívó paraméteréből: az AppendSdkEventInput típusnak nincs kapcsoló mezője (59. kritérium)', () => {
      // Fordítási idejű bizonyíték: az `AppendSdkEventInput` interfész
      // pontosan három mezőt hordoz. Ha valaha delta kapcsoló mezővel
      // bővülne, ez az assertion megbukna.
      const input: AppendSdkEventInput = { runId: 'x', stepRunId: null, message: {} };
      expect(Object.keys(input)).toStrictEqual(['runId', 'stepRunId', 'message']);
    });

    it('not_found hibaágat ad ismeretlen runId-ra', () => {
      const { sqlite, repository } = openRepository();
      const outcome = repository.appendSdkEvent(sdkInput('nincs-ilyen', { type: 'assistant', message: {} }));
      expect(errorOrThrow(outcome)).toContain('not_found');
      sqlite.close();
    });

    it('egy váratlan adatbázis hiba (nem egyedi index sértés) továbbrepül, nem alakul csendben duplicate_event-té', () => {
      // FK sértés (SQLITE_CONSTRAINT_FOREIGNKEY, nem SQLITE_CONSTRAINT_UNIQUE)
      // a step_run_id oszlopon: ismeretlen step_run azonosító. Ez bizonyítja,
      // hogy az insertSdkEventRow catch ága szelektív - csak az egyedi index
      // sértést fordítja duplicate_event-té, minden mást továbbenged, amit a
      // `transaction` wrapper alakít generikus Outcome hibaággá.
      const { sqlite, database, repository } = openRepository();
      seedRun(database, { workflowId: 'w1', runId: 'run-1' });

      const outcome = repository.appendSdkEvent({
        runId: 'run-1',
        stepRunId: 'nincs-ilyen-step',
        message: { type: 'assistant', message: {} },
      });
      const message = errorOrThrow(outcome);
      expect(message).not.toContain('duplicate_event');
      expect(message).not.toContain('not_found');

      sqlite.close();
    });

    it('unrecognized_sdk_message_type hibaágat ad, beszúrás nélkül', () => {
      const { sqlite, database, repository } = openRepository();
      seedRun(database, { workflowId: 'w1', runId: 'run-1' });

      const outcome = repository.appendSdkEvent(sdkInput('run-1', { type: 'keep_alive' }));
      expect(errorOrThrow(outcome)).toContain('unrecognized_sdk_message_type');
      expect(database.select().from(runEventTable).all()).toStrictEqual([]);

      sqlite.close();
    });

    it('duplicate_event hibaágat ad, ha ugyanaz az sdk_uuid ugyanarra a run_id-re kétszer kerül beszúrásra (19. kritérium)', () => {
      const { sqlite, database, repository } = openRepository();
      seedRun(database, { workflowId: 'w1', runId: 'run-1' });

      const message = { type: 'assistant', uuid: 'ismetelt-uuid', message: {} };
      const first = okOrThrow(repository.appendSdkEvent(sdkInput('run-1', message)));
      expect(first.status).toBe('written');

      const second = repository.appendSdkEvent(sdkInput('run-1', message));
      expect(errorOrThrow(second)).toContain('duplicate_event');
      expect(database.select().from(runEventTable).all()).toHaveLength(1);

      sqlite.close();
    });

    it('ugyanaz az sdk_uuid két különböző run_id alatt nem ütközik', () => {
      const { sqlite, database, repository } = openRepository();
      seedRun(database, { workflowId: 'w1', runId: 'run-1' });
      seedRun(database, { workflowId: 'w2', runId: 'run-2' });

      const message = { type: 'assistant', uuid: 'megosztott-uuid', message: {} };
      const firstOutcome = okOrThrow(repository.appendSdkEvent(sdkInput('run-1', message)));
      const secondOutcome = okOrThrow(repository.appendSdkEvent(sdkInput('run-2', message)));
      expect(firstOutcome.status).toBe('written');
      expect(secondOutcome.status).toBe('written');
      expect(database.select().from(runEventTable).all()).toHaveLength(2);

      sqlite.close();
    });
  });

  describe('appendEngineEvent', () => {
    it('written: beszúr egy motor eredetű sort, minden sdk_* oszlop NULL marad', () => {
      const { sqlite, database, repository } = openRepository();
      seedRun(database, { workflowId: 'w1', runId: 'run-1' });

      const input = engineInput('run-1', { kind: 'run_finished', occurredAtMs: new Date(500) });
      const outcome = okOrThrow(repository.appendEngineEvent(input));
      const row = database.select().from(runEventTable).where(eq(runEventTable.id, outcome.eventId)).get();
      expect(row?.origin).toBe('engine');
      expect(row?.kind).toBe('run_finished');
      expect(row?.occurredAtMs).toStrictEqual(new Date(500));
      expect(row?.sdkMessageType).toBeNull();
      expect(row?.sdkUuid).toBeNull();
      expect(row?.inputTokens).toBeNull();

      sqlite.close();
    });

    it('occurredAtMs elhagyásakor a beszúrás pillanatához közeli időbélyeget kap', () => {
      const { sqlite, database, repository } = openRepository();
      seedRun(database, { workflowId: 'w1', runId: 'run-1' });

      const before = Date.now();
      const outcome = okOrThrow(repository.appendEngineEvent(engineInput('run-1')));
      const after = Date.now();

      const row = database.select().from(runEventTable).where(eq(runEventTable.id, outcome.eventId)).get();
      const occurredAtMs = row?.occurredAtMs.getTime() ?? -1;
      expect(occurredAtMs).toBeGreaterThanOrEqual(before);
      expect(occurredAtMs).toBeLessThanOrEqual(after);

      sqlite.close();
    });

    it('not_found hibaágat ad ismeretlen runId-ra', () => {
      const { sqlite, repository } = openRepository();
      const outcome = repository.appendEngineEvent(engineInput('nincs-ilyen'));
      expect(errorOrThrow(outcome)).toContain('not_found');
      sqlite.close();
    });

    it('nincs delta kapcsoló ellenőrzés: minden engine kind mindkét állásban ír sort', () => {
      const { sqlite, database, repository } = openRepository();
      seedRun(database, { workflowId: 'w1', runId: 'run-off', persistedStreamDeltas: false });
      seedRun(database, { workflowId: 'w2', runId: 'run-on', persistedStreamDeltas: true });

      okOrThrow(repository.appendEngineEvent(engineInput('run-off')));
      okOrThrow(repository.appendEngineEvent(engineInput('run-on')));

      expect(database.select().from(runEventTable).where(eq(runEventTable.runId, 'run-off')).all()).toHaveLength(1);
      expect(database.select().from(runEventTable).where(eq(runEventTable.runId, 'run-on')).all()).toHaveLength(1);

      sqlite.close();
    });
  });

  describe('readEventsSince', () => {
    it('a run_id szerint szűr, id > afterEventId szerint szűkít, id szerint növekvő sorrendben ad listát', () => {
      const { sqlite, database, repository } = openRepository();
      seedRun(database, { workflowId: 'w1', runId: 'run-1' });
      seedRun(database, { workflowId: 'w2', runId: 'run-2' });

      const firstEvent = okOrThrow(
        repository.appendEngineEvent({ runId: 'run-1', stepRunId: null, kind: 'run_started', payload: {} }),
      );
      const secondEvent = okOrThrow(
        repository.appendEngineEvent({ runId: 'run-1', stepRunId: null, kind: 'step_started', payload: {} }),
      );
      okOrThrow(repository.appendEngineEvent({ runId: 'run-2', stepRunId: null, kind: 'run_started', payload: {} }));
      const thirdEvent = okOrThrow(
        repository.appendEngineEvent({ runId: 'run-1', stepRunId: null, kind: 'step_finished', payload: {} }),
      );

      const events = okOrThrow(repository.readEventsSince('run-1', firstEvent.eventId, 10));
      expect(events.map((event) => event.id)).toStrictEqual([secondEvent.eventId, thirdEvent.eventId]);
      expect(events.every((event) => event.runId === 'run-1')).toBe(true);

      sqlite.close();
    });

    it('a limit paramétert alkalmazza', () => {
      const { sqlite, database, repository } = openRepository();
      seedRun(database, { workflowId: 'w1', runId: 'run-1' });

      okOrThrow(repository.appendEngineEvent({ runId: 'run-1', stepRunId: null, kind: 'run_started', payload: {} }));
      okOrThrow(repository.appendEngineEvent({ runId: 'run-1', stepRunId: null, kind: 'step_started', payload: {} }));
      okOrThrow(repository.appendEngineEvent({ runId: 'run-1', stepRunId: null, kind: 'step_finished', payload: {} }));

      const events = okOrThrow(repository.readEventsSince('run-1', 0, 2));
      expect(events).toHaveLength(2);

      sqlite.close();
    });

    it('üres listát ad, ha nincs újabb esemény', () => {
      const { sqlite, database, repository } = openRepository();
      seedRun(database, { workflowId: 'w1', runId: 'run-1' });
      const firstEvent = okOrThrow(
        repository.appendEngineEvent({ runId: 'run-1', stepRunId: null, kind: 'run_started', payload: {} }),
      );

      expect(okOrThrow(repository.readEventsSince('run-1', firstEvent.eventId, 10))).toStrictEqual([]);

      sqlite.close();
    });

    it('invalid_run_event_kind hibaágat ad, ha a tárolt kind nem érvényes RunEventKind (korrupt adat)', () => {
      const { sqlite, database, repository } = openRepository();
      seedRun(database, { workflowId: 'w1', runId: 'run-1' });
      database
        .insert(runEventTable)
        .values({ runId: 'run-1', origin: 'engine', kind: 'nem-letezo-kind', occurredAtMs: new Date(0), payload: {} })
        .run();

      expect(errorOrThrow(repository.readEventsSince('run-1', 0, 10))).toContain('invalid_run_event_kind');

      sqlite.close();
    });
  });

  describe('readEventsForStep', () => {
    it('a step_run_id szerint szűr, id szerint növekvő sorrendben, limittel', () => {
      const { sqlite, database, repository } = openRepository();
      seedRun(database, { workflowId: 'w1', runId: 'run-1' });
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

      const firstEvent = okOrThrow(
        repository.appendEngineEvent({ runId: 'run-1', stepRunId: 'step-1', kind: 'step_started', payload: {} }),
      );
      okOrThrow(repository.appendEngineEvent({ runId: 'run-1', stepRunId: null, kind: 'run_started', payload: {} }));
      const secondEvent = okOrThrow(
        repository.appendEngineEvent({ runId: 'run-1', stepRunId: 'step-1', kind: 'step_finished', payload: {} }),
      );

      const events = okOrThrow(repository.readEventsForStep('step-1', 10));
      expect(events.map((event) => event.id)).toStrictEqual([firstEvent.eventId, secondEvent.eventId]);

      const limited = okOrThrow(repository.readEventsForStep('step-1', 1));
      expect(limited).toHaveLength(1);

      sqlite.close();
    });

    it('invalid_run_event_kind hibaágat ad korrupt kind esetén', () => {
      const { sqlite, database, repository } = openRepository();
      seedRun(database, { workflowId: 'w1', runId: 'run-1' });
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
      database
        .insert(runEventTable)
        .values({
          runId: 'run-1',
          stepRunId: 'step-1',
          origin: 'engine',
          kind: 'meg-egy-hamis',
          occurredAtMs: new Date(0),
          payload: {},
        })
        .run();

      expect(errorOrThrow(repository.readEventsForStep('step-1', 10))).toContain('invalid_run_event_kind');

      sqlite.close();
    });
  });

  describe('aggregateRunTokens', () => {
    it('nulla run_event sorra nulla összeget ad, nem NULL-t', () => {
      const { sqlite, database, repository } = openRepository();
      seedRun(database, { workflowId: 'w1', runId: 'run-1' });

      const totals = okOrThrow(repository.aggregateRunTokens('run-1'));
      expect(totals).toStrictEqual({
        inputTokens: 0,
        outputTokens: 0,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0,
      });

      sqlite.close();
    });

    it('összegzi a négy token oszlopot a sdk_assistant és sdk_result sorokból', () => {
      const { sqlite, database, repository } = openRepository();
      seedRun(database, { workflowId: 'w1', runId: 'run-1' });

      okOrThrow(repository.appendSdkEvent(sdkInput('run-1', { type: 'assistant', message: { content: [], usage } })));
      okOrThrow(repository.appendSdkEvent(sdkInput('run-1', { type: 'result', subtype: 'success', usage })));

      const totals = okOrThrow(repository.aggregateRunTokens('run-1'));
      expect(totals).toStrictEqual({
        inputTokens: 200,
        outputTokens: 100,
        cacheReadInputTokens: 20,
        cacheCreationInputTokens: 10,
      });

      sqlite.close();
    });

    it('a delta kapcsoló mindkét állásában azonos összeget ad, ugyanazzal a bemeneti sorozattal (60., 61. kritérium)', () => {
      const { sqlite, database, repository } = openRepository();
      seedRun(database, { workflowId: 'w-off', runId: 'run-off', persistedStreamDeltas: false });
      seedRun(database, { workflowId: 'w-on', runId: 'run-on', persistedStreamDeltas: true });

      function feed(runId: string): void {
        okOrThrow(repository.appendSdkEvent(sdkInput(runId, { type: 'system', subtype: 'init', session_id: 'ses-1' })));
        okOrThrow(
          repository.appendSdkEvent(sdkInput(runId, { type: 'stream_event', event: { type: 'content_block_delta' } })),
        );
        okOrThrow(repository.appendSdkEvent(sdkInput(runId, { type: 'stream_event', event: { type: 'ping' } })));
        okOrThrow(repository.appendSdkEvent(sdkInput(runId, { type: 'assistant', message: { content: [], usage } })));
        okOrThrow(
          repository.appendSdkEvent(sdkInput(runId, { type: 'user', message: { role: 'user', content: 'ok' } })),
        );
        okOrThrow(repository.appendSdkEvent(sdkInput(runId, { type: 'result', subtype: 'success', usage })));
      }

      feed('run-off');
      feed('run-on');

      const offEvents = okOrThrow(repository.readEventsSince('run-off', 0, 100));
      const onEvents = okOrThrow(repository.readEventsSince('run-on', 0, 100));

      // Kikapcsolva a két sdk_stream_event sor kimarad (58. kritérium),
      // szigorúan kevesebb sor, mint bekapcsolva (60. kritérium).
      expect(offEvents).toHaveLength(4);
      expect(onEvents).toHaveLength(6);
      expect(offEvents.some((event) => event.kind === 'sdk_stream_event')).toBe(false);

      // A transcript viszont mindkét oldalon tartalmazza a négy nem-stream
      // kind minden sorát.
      const offKinds = new Set(offEvents.map((event) => event.kind));
      expect(offKinds).toStrictEqual(new Set(['sdk_system', 'sdk_assistant', 'sdk_user', 'sdk_result']));

      // A token összesítés mindkét állásban azonos (61. kritérium: a
      // normalizáló sdk_stream_event sorból soha nem tölt usage oszlopot,
      // tehát a kihagyott két sor nem hiányzik az összegből).
      const offTotals = okOrThrow(repository.aggregateRunTokens('run-off'));
      const onTotals = okOrThrow(repository.aggregateRunTokens('run-on'));
      expect(offTotals).toStrictEqual(onTotals);
      expect(offTotals).toStrictEqual({
        inputTokens: 200,
        outputTokens: 100,
        cacheReadInputTokens: 20,
        cacheCreationInputTokens: 10,
      });

      sqlite.close();
    });
  });

  /**
   * SPEC-003 15. szekció 58. kritérium, T-003-28 átvizsgálás: "Kikapcsolt
   * állapotban ugyanaz a bemeneti sorozat **nulla** `sdk_stream_event` sort
   * ír, a másik tizenegy `sdk` eredetű `kind` minden sorát megírja az
   * `appendSdkEvent`, és mind a tizenhárom `engine` eredetű `kind` minden
   * sorát megírja az `appendEngineEvent`."
   *
   * **A "tizenegy" szó szerint NEM teljesíthető: csak TÍZ tesztelhető.** A
   * `run-event-kind.ts` 12 `sdk` eredetű értékéből a `sdk_stream_event`-en
   * kívüli 11 közül a `sdk_context_usage`-ra a pinelt Agent SDK verzióban
   * NINCS leképezés a `normalizeSdkMessage`-en át (lásd
   * `normalize-sdk-message.ts` "NYITOTT PONT" bekezdése és
   * `packages/db/CLAUDE.md`, T-003-20): nincs olyan nyers `type`/`subtype`,
   * amiből ez a `kind` keletkezne. Ezt a tesztet ezért NEM egy kitalált nyers
   * üzenettel kerüljük meg - a hiányzó tizenegyedik eset dokumentált tény,
   * nem hézag a tesztben. A `sdk_stream_event` kikapcsolt állapotú `skipped`/
   * nulla sor ága a fenti `appendSdkEvent` describe blokkban már fedett
   * ("skipped: sdk_stream_event kikapcsolt persisted_stream_deltas mellett
   * nem ír sort (58., 59. kritérium)"), itt nem ismételjük meg.
   */
  describe('a delta kapcsoló kikapcsolt állapotban minden nem-sdk_stream_event kind sorát megírja (58. kritérium)', () => {
    const nonStreamSdkCases: readonly { readonly kind: RunEventKind; readonly message: unknown }[] = [
      { kind: 'sdk_system', message: { type: 'system', subtype: 'init' } },
      { kind: 'sdk_assistant', message: { type: 'assistant', message: { content: [] } } },
      { kind: 'sdk_user', message: { type: 'user', message: { role: 'user', content: 'szia' } } },
      { kind: 'sdk_result', message: { type: 'result', subtype: 'success' } },
      { kind: 'sdk_hook_started', message: { type: 'system', subtype: 'hook_started' } },
      { kind: 'sdk_hook_progress', message: { type: 'system', subtype: 'hook_progress' } },
      { kind: 'sdk_hook_response', message: { type: 'system', subtype: 'hook_response' } },
      { kind: 'sdk_informational', message: { type: 'system', subtype: 'informational' } },
      { kind: 'sdk_commands_changed', message: { type: 'system', subtype: 'commands_changed' } },
      { kind: 'sdk_rate_limit', message: { type: 'rate_limit_event', rate_limit_info: { status: 'allowed' } } },
    ];

    it('pontosan tíz nem-sdk_stream_event sdk eredetű kind tesztelhető ténylegesen (a sdk_context_usage kimarad)', () => {
      expect(nonStreamSdkCases).toHaveLength(10);
    });

    it.each(nonStreamSdkCases)(
      '$kind: appendSdkEvent kikapcsolt persisted_stream_deltas mellett is ír sort',
      ({ kind, message }) => {
        const { sqlite, database, repository } = openRepository();
        seedRun(database, { workflowId: 'w1', runId: 'run-1', persistedStreamDeltas: false });

        const outcome = okOrThrow(repository.appendSdkEvent(sdkInput('run-1', message)));
        expect(outcome.status).toBe('written');

        const rows = database.select().from(runEventTable).where(eq(runEventTable.runId, 'run-1')).all();
        expect(rows).toHaveLength(1);
        expect(rows[0]?.kind).toBe(kind);

        sqlite.close();
      },
    );

    const ALL_ENGINE_KINDS: readonly EngineRunEventKind[] = [
      'run_started',
      'run_finished',
      'run_interrupted',
      'step_started',
      'step_finished',
      'branch_taken',
      'fan_out_expanded',
      'join_resolved',
      'loop_iteration_started',
      'approval_requested',
      'approval_decided',
      'sub_workflow_started',
      'sub_workflow_finished',
    ];

    it('mind a tizenhárom engine eredetű kind szerepel a listán', () => {
      expect(ALL_ENGINE_KINDS).toHaveLength(13);
    });

    it.each(ALL_ENGINE_KINDS.map((kind) => ({ kind })))(
      '$kind: appendEngineEvent kikapcsolt persisted_stream_deltas mellett is ír sort',
      ({ kind }) => {
        const { sqlite, database, repository } = openRepository();
        seedRun(database, { workflowId: 'w1', runId: 'run-1', persistedStreamDeltas: false });

        const outcome = okOrThrow(repository.appendEngineEvent(engineInput('run-1', { kind })));
        const row = database.select().from(runEventTable).where(eq(runEventTable.id, outcome.eventId)).get();
        expect(row?.kind).toBe(kind);

        sqlite.close();
      },
    );
  });
});
