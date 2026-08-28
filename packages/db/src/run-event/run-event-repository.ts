import SqliteDatabase from 'better-sqlite3';
import { and, asc, eq, gt, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { Outcome } from '@easter-workflow-builder/core';
import { runEventTable } from './run-event.ts';
import { isRunEventKind } from './is-run-event-kind.ts';
import type { RunEventKind } from './run-event-kind.ts';
import { normalizeSdkMessage } from './normalize-sdk-message.ts';
import type { NormalizedSdkMessage } from './normalize-sdk-message.ts';
import { insertEngineEventRow } from './insert-engine-event-row.ts';
import { extractErrorCause } from './extract-error-cause.ts';

/**
 * Ugyanaz az aláírás, mint a `DatabaseContext.transaction` (SPEC-003 9.1
 * szekció). Nem onnan importáljuk, hogy elkerüljük a kört, ugyanaz a minta,
 * mint a `workflow-run-repository.ts`-ben.
 */
type TransactionFunction = <TValue>(work: () => Outcome<TValue>) => Outcome<TValue>;

/**
 * A 25 `RunEventKind` értékből a 13 `engine` eredetű (SPEC-003 6.4 szekció).
 * A tizenkettő `sdk` eredetű érték mindegyike `sdk_` előtaggal kezdődik
 * (`run-event-kind.ts`), a tizenhárom `engine` eredetű egyike sem - a
 * `Exclude` ezt a mintát használja ki, tehát a két lista nem futhat szét: ha
 * a `RunEventKind` unió bővül egy `sdk_` előtagú értékkel, az automatikusan
 * kimarad innen, minden más automatikusan bekerül. Ez váltja ki a T-003-21
 * feladatleírás "TypeScript szinten már szűkített unió" opcióját: az
 * `appendEngineEvent` hívója (a motor) fordítási időben nem tud `sdk_`
 * eredetű `kind`-ot átadni, tehát nincs szükség külön futásidejű guardra itt.
 */
export type EngineRunEventKind = Exclude<RunEventKind, `sdk_${string}`>;

/**
 * Az `appendSdkEvent` bemenete (SPEC-003 9.2 és 6.6 szekció, 59. kritérium).
 * **Szándékosan NINCS benne delta kapcsoló mező**: a hívó (a motor) nem tud a
 * futás beállításától eltérőt kérni, a döntés kizárólag a `workflow_run`
 * sorban befagyasztott értékből jön (lásd `insertSdkEventRow` lent).
 */
export interface AppendSdkEventInput {
  readonly runId: string;
  readonly stepRunId: string | null;
  readonly message: unknown;
}

export type AppendSdkEventResult =
  { readonly status: 'written'; readonly eventId: number } | { readonly status: 'skipped' };

/**
 * Az `appendEngineEvent` bemenete (SPEC-003 9.2 szekció). Nincs delta
 * kapcsoló: a 6.6 szekció "Melyik esemény fajták esnek a kapcsoló alá"
 * alszekciója szerint az kizárólag a `sdk_stream_event` `kind`-ra hat, a
 * motor eredetű eseményekre soha.
 */
export interface AppendEngineEventInput {
  readonly runId: string;
  readonly stepRunId: string | null;
  readonly kind: EngineRunEventKind;
  readonly payload: unknown;
  readonly occurredAtMs?: Date;
}

export interface RunEventRecord {
  readonly id: number;
  readonly runId: string;
  readonly stepRunId: string | null;
  readonly origin: string;
  readonly kind: RunEventKind;
  readonly occurredAtMs: Date;
  readonly sdkMessageType: string | null;
  readonly sdkMessageSubtype: string | null;
  readonly sdkSessionId: string | null;
  readonly sdkUuid: string | null;
  readonly parentToolUseId: string | null;
  readonly toolName: string | null;
  readonly toolUseId: string | null;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly cacheReadInputTokens: number | null;
  readonly cacheCreationInputTokens: number | null;
  readonly numTurns: number | null;
  readonly payload: unknown;
}

/**
 * Az `aggregateRunTokens` visszatérési értéke: a négy token oszlop összege
 * egy futásra (SPEC-003 9.2 szekció). Sosem `null`: nulla `run_event` sorra
 * is nulla összeget ad, `COALESCE` a `SUM()` köré (lásd lent).
 */
export interface RunEventTokenAggregate {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheReadInputTokens: number;
  readonly cacheCreationInputTokens: number;
}

export interface RunEventRepository {
  appendSdkEvent(input: AppendSdkEventInput): Outcome<AppendSdkEventResult>;
  appendEngineEvent(input: AppendEngineEventInput): Outcome<{ readonly eventId: number }>;
  readEventsSince(runId: string, afterEventId: number, limit: number): Outcome<readonly RunEventRecord[]>;
  readEventsForStep(stepRunId: string, limit: number): Outcome<readonly RunEventRecord[]>;
  aggregateRunTokens(runId: string): Outcome<RunEventTokenAggregate>;
}

function notFoundMessage(runId: string): string {
  return `A(z) "${runId}" azonosítójú futás nem található (not_found).`;
}

function duplicateEventMessage(runId: string, sdkUuid: string): string {
  return `A(z) "${sdkUuid}" azonosítójú SDK esemény már be van szúrva a(z) "${runId}" futáshoz (duplicate_event).`;
}

/**
 * A nyers Drizzle sor típusos `RunEventRecord`-dá alakítása, a `kind` oszlop
 * `isRunEventKind` alapú szűkítésével (SPEC-003 9.4 szekció): az oszlopon
 * nincs DB szintű `CHECK` (6.4 szekció), tehát egy korrupt sor lehetséges.
 * Az `origin` szándékosan raw `string` marad: nincs rá bejegyzett domain
 * guard a 9.4 listán, és a repositoryban semmilyen elágazó logika nem néz
 * bele (ugyanaz a döntés, mint a `step_run.node_type`/`session_mode`
 * oszlopnál, lásd `packages/db/CLAUDE.md`).
 */
function toRunEventRecord(row: typeof runEventTable.$inferSelect): Outcome<RunEventRecord> {
  const kind = row.kind;
  if (!isRunEventKind(kind)) {
    return {
      kind: 'error',
      message: `A(z) ${String(row.id)} azonosítójú esemény kind mezője érvénytelen: "${kind}" (invalid_run_event_kind).`,
    };
  }
  return {
    kind: 'ok',
    value: {
      id: row.id,
      runId: row.runId,
      stepRunId: row.stepRunId,
      origin: row.origin,
      kind,
      occurredAtMs: row.occurredAtMs,
      sdkMessageType: row.sdkMessageType,
      sdkMessageSubtype: row.sdkMessageSubtype,
      sdkSessionId: row.sdkSessionId,
      sdkUuid: row.sdkUuid,
      parentToolUseId: row.parentToolUseId,
      toolName: row.toolName,
      toolUseId: row.toolUseId,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      cacheReadInputTokens: row.cacheReadInputTokens,
      cacheCreationInputTokens: row.cacheCreationInputTokens,
      numTurns: row.numTurns,
      payload: row.payload,
    },
  };
}

function collectRunEventRecords(
  rows: readonly (typeof runEventTable.$inferSelect)[],
): Outcome<readonly RunEventRecord[]> {
  const records: RunEventRecord[] = [];
  for (const row of rows) {
    const outcome = toRunEventRecord(row);
    if (outcome.kind === 'error') {
      return outcome;
    }
    records.push(outcome.value);
  }
  return { kind: 'ok', value: records };
}

/**
 * `packages/db/CLAUDE.md` "Outcome hibaosztály konvenció" szerint: a
 * hibaosztály neve szó szerint, zárójelben áll az emberi nyelvű üzenetben.
 */
export function createRunEventRepository(
  database: BetterSQLite3Database,
  transaction: TransactionFunction,
): RunEventRepository {
  /**
   * A delta kapcsolót érvényesítő egyetlen beszúró utasítás (SPEC-003 6.6
   * szekció "Hogyan nem kerülhető meg" alszekció, 59. kritérium, A
   * LEGKRITIKUSABB RÉSZ). A `WHERE` feltétel a `workflow_run` sorból olvassa
   * ki a befagyasztott `persisted_stream_deltas` értéket - ez a függvény
   * (és rajta át az `appendSdkEvent`) nem kap, és nem is használ, kapcsoló
   * mezőt hívói paraméterből.
   *
   * **Nulla módosított sor kétféle okból lehet** (6.6 szekció, utolsó
   * bekezdés): (a) a futás nem létezik - ez a ritka ág, külön létezés
   * ellenőrzéssel különböztetve meg; (b) a kapcsoló miatt lett kihagyva -
   * ez NEM hiba, `{ status: 'skipped' }` sikeres `Outcome`. A forró út
   * (a normál eset) egyetlen SQL utasítás marad.
   *
   * **A `better-sqlite3` egyedi index sértését** (`run_event_run_uuid_uq`,
   * `SQLITE_CONSTRAINT_UNIQUE`) itt kapjuk el, és `duplicate_event` `Outcome`
   * hibaágra fordítjuk (19. kritérium), ugyanaz a minta, mint a
   * `provider-concurrency-repository.ts` `setLimit`-jében a
   * `SQLITE_CONSTRAINT_CHECK`-nél: minden más hibakód továbbrepül, a
   * `transaction` wrapper alakítja `Outcome`-má.
   */
  function insertSdkEventRow(
    runId: string,
    stepRunId: string | null,
    occurredAtMs: Date,
    normalized: NormalizedSdkMessage,
  ): Outcome<AppendSdkEventResult> {
    const payloadJson = JSON.stringify(normalized.payload);
    let result: SqliteDatabase.RunResult;
    try {
      result = database.run(sql`
        INSERT INTO run_event (
          run_id, step_run_id, origin, kind, occurred_at_ms,
          sdk_message_type, sdk_message_subtype, sdk_session_id, sdk_uuid,
          parent_tool_use_id, tool_name, tool_use_id,
          input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens,
          num_turns, payload
        )
        SELECT
          ${runId}, ${stepRunId}, 'sdk', ${normalized.kind}, ${occurredAtMs.getTime()},
          ${normalized.sdkMessageType}, ${normalized.sdkMessageSubtype}, ${normalized.sdkSessionId}, ${normalized.sdkUuid},
          ${normalized.parentToolUseId}, ${normalized.toolName}, ${normalized.toolUseId},
          ${normalized.inputTokens}, ${normalized.outputTokens}, ${normalized.cacheReadInputTokens}, ${normalized.cacheCreationInputTokens},
          ${normalized.numTurns}, ${payloadJson}
          FROM workflow_run
         WHERE id = ${runId}
           AND (${normalized.kind} <> 'sdk_stream_event' OR persisted_stream_deltas = 1)
      `);
    } catch (error) {
      // A `database.run(sql\`...\`)` (a Drizzle `BaseSQLiteDatabase.run`,
      // `sqlite-core/db.js`) a `session.run()`-on át fut, ami minden hibát
      // elkap és egy ÚJ `DrizzleError`-ba csomagol, az eredeti
      // `better-sqlite3` `SqliteError`-t a `.cause` mezőben hordozva
      // (`sqlite-core/session.js`, `catch (err) { throw new DrizzleError({
      // cause: err, ... }) }`) - ezért itt a `.cause`-t kell vizsgálni, NEM
      // magát a kapott hibát (szemben a `provider-concurrency-repository.ts`
      // `setLimit`-jével, ami a Drizzle TÍPUSOS insert-builder saját
      // `.run()`-ját hívja, ami nem csomagol be, és közvetlenül a nyers
      // `SqliteError`-t dobja - saját méréssel ellenőrizve, mindkét
      // útvonalon). A `.cause` kiszedése külön fájlban (`extract-error-cause.ts`),
      // mert az `error instanceof Error` ág "false" oldala itt sosem állna elő
      // (a `DrizzleError` mindig `Error` példány), és a 100%-os branch
      // lefedettség (SPEC-003 12.4) emiatt le nem fedhető ágat hagyna itt.
      const cause = extractErrorCause(error);
      if (
        cause instanceof SqliteDatabase.SqliteError &&
        cause.code === 'SQLITE_CONSTRAINT_UNIQUE' &&
        normalized.sdkUuid !== null
      ) {
        return { kind: 'error', message: duplicateEventMessage(runId, normalized.sdkUuid) };
      }
      throw error;
    }

    if (result.changes > 0) {
      return { kind: 'ok', value: { status: 'written', eventId: Number(result.lastInsertRowid) } };
    }

    // Ritka ág: kell a külön létezés ellenőrzés, hogy a "nincs ilyen futás"
    // és a "kihagyva a kapcsoló miatt" esetet szét lehessen választani
    // (6.6 szekció). Nyers SQL, ugyanaz a minta, mint a
    // `workflow-run-repository.ts` `readStoredCanonicalText`-jében: a
    // Drizzle `.get<T>()` deklarált típusa nem tartalmaz `undefined`-et,
    // holott a mögöttes `better-sqlite3` `stmt.get()` ténylegesen azt ad
    // vissza nulla találatra.
    const existing = database.get<{ id: string }>(sql`SELECT id FROM workflow_run WHERE id = ${runId}`);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, sonarjs/different-types-comparison -- lásd a fenti indoklást
    if (existing === undefined) {
      return { kind: 'error', message: notFoundMessage(runId) };
    }
    return { kind: 'ok', value: { status: 'skipped' } };
  }

  function appendSdkEvent(input: AppendSdkEventInput): Outcome<AppendSdkEventResult> {
    return transaction(() => {
      const normalized = normalizeSdkMessage(input.message);
      if (normalized.kind === 'error') {
        return normalized;
      }
      return insertSdkEventRow(input.runId, input.stepRunId, new Date(), normalized.value);
    });
  }

  function appendEngineEvent(input: AppendEngineEventInput): Outcome<{ readonly eventId: number }> {
    return transaction(() =>
      insertEngineEventRow(database, {
        runId: input.runId,
        stepRunId: input.stepRunId,
        kind: input.kind,
        occurredAtMs: input.occurredAtMs ?? new Date(),
        payload: input.payload,
      }),
    );
  }

  /**
   * `WHERE run_id = ? AND id > ? ORDER BY id LIMIT ?`, a `run_event_run_id_idx`
   * `(run_id, id)` indexet használva (SPEC-003 6.3 és 6.5 szekció). A `limit`
   * **kötelező**, nincs alapérték (42. kritérium): a hívó felelőssége eldönteni,
   * mennyi eseményt kér egy replay lapon.
   */
  function readEventsSince(runId: string, afterEventId: number, limit: number): Outcome<readonly RunEventRecord[]> {
    return transaction(() => {
      const rows = database
        .select()
        .from(runEventTable)
        .where(and(eq(runEventTable.runId, runId), gt(runEventTable.id, afterEventId)))
        .orderBy(asc(runEventTable.id))
        .limit(limit)
        .all();
      return collectRunEventRecords(rows);
    });
  }

  /**
   * `WHERE step_run_id = ? ORDER BY id LIMIT ?`, a `run_event_step_run_id_idx`
   * indexet használva.
   */
  function readEventsForStep(stepRunId: string, limit: number): Outcome<readonly RunEventRecord[]> {
    return transaction(() => {
      const rows = database
        .select()
        .from(runEventTable)
        .where(eq(runEventTable.stepRunId, stepRunId))
        .orderBy(asc(runEventTable.id))
        .limit(limit)
        .all();
      return collectRunEventRecords(rows);
    });
  }

  /**
   * `COALESCE(SUM(...), 0)` a négy token oszlopra, `WHERE run_id = ?` alatt,
   * a `run_event_run_id_idx` indexet használva (6.5 szekció, "Token
   * összesítéshez ... elegendő"). Aggregát lekérdezés `GROUP BY` nélkül
   * SQLite-ban mindig pontosan egy sort ad, akkor is, ha nulla `run_event`
   * sor illeszkedik a szűrésre (a `COALESCE` ilyenkor `NULL` helyett 0-t ad),
   * tehát itt - a `.get<T>()` többi helyi használatával ellentétben - nincs
   * `undefined` eset, a deklarált típus a valós viselkedést tükrözi.
   *
   * Mivel a `normalizeSdkMessage` (T-003-20) `sdk_stream_event` sorból soha
   * nem tölti a négy `usage` oszlopot, ez az összesítés a delta kapcsoló
   * mindkét állásában azonos eredményt ad (61. kritérium).
   */
  function aggregateRunTokens(runId: string): Outcome<RunEventTokenAggregate> {
    return transaction(() => {
      const row = database.get<RunEventTokenAggregate>(sql`
        SELECT
          COALESCE(SUM(input_tokens), 0) AS inputTokens,
          COALESCE(SUM(output_tokens), 0) AS outputTokens,
          COALESCE(SUM(cache_read_input_tokens), 0) AS cacheReadInputTokens,
          COALESCE(SUM(cache_creation_input_tokens), 0) AS cacheCreationInputTokens
          FROM run_event
         WHERE run_id = ${runId}
      `);
      return { kind: 'ok', value: row };
    });
  }

  return { appendSdkEvent, appendEngineEvent, readEventsSince, readEventsForStep, aggregateRunTokens };
}
