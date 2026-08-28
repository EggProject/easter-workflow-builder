import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { stepRunTable } from '../../step-run/step-run.ts';
import { workflowRunTable } from '../../workflow-run/workflow-run.ts';

/**
 * A `run_event` tábla (SPEC-003 6.2 szekció). Egy sor egyetlen eseményt ír
 * le, akár az SDK-ból jött (`origin = 'sdk'`), akár a motor saját eseménye
 * (`origin = 'engine'`); a `kind` diszkriminátor a 25 lehetséges értéket
 * a `RunEventKind` unió adja (`run-event-kind.ts`).
 *
 * **Az `id` `INTEGER PRIMARY KEY AUTOINCREMENT`, NEM sima `INTEGER PRIMARY
 * KEY`** (F-9, F-13, 9. kritérium). A különbség kritikus: a sima
 * `INTEGER PRIMARY KEY` a törölt legnagyobb rowid értéket újrahasznosíthatja,
 * az `AUTOINCREMENT` a `sqlite_sequence` táblán keresztül szigorúan monoton,
 * soha újra nem használt értéket ad. Ez az egyetlen sorszám a WebSocket
 * replayhez (SPEC-003 6.3 szekció): a kliens a legutóbb látott `id`-t küldi,
 * a szerver a `WHERE run_id = ? AND id > ? ORDER BY id` sorokat adja vissza,
 * és ez csak akkor helyes, ha egy törölt sor helye soha nem térhet vissza
 * másik esemény alatt.
 *
 * **A `step_run_id` opcionális**: futás szintű eseménynél (pl. `run_started`)
 * NULL, lépéshez kötött eseménynél a `step_run.id`-ra mutat, `ON DELETE
 * CASCADE` viselkedéssel. A `run_id` mindig kötelező, `ON DELETE CASCADE`
 * a `workflow_run` táblára (4.15 szekció kaszkád lánca).
 *
 * **A `kind` oszlopon NINCS `CHECK` constraint** (6.4 szekció szó szerint):
 * egy új SDK üzenettípus különben migrációt igényelne. A szűkítést az
 * `isRunEventKind` guard adja a repository határon (T-003-21).
 *
 * **Minden SDK eredetű normalizált mező nullable** (6.2 szekció, 10.
 * kritérium): a kinyerést typeguard végzi a nyers üzeneten (T-003-20), ha egy
 * mező hiányzik, az oszlop NULL marad. Költség oszlop szándékosan nincs: a
 * `result.total_cost_usd` a nyers `payload` JSON-ban marad, mert a `minimax`
 * providerre nincs saját árazási forrásunk (6.2 szekció).
 *
 * **A négy `usage` oszlopot a normalizáló kizárólag `sdk_assistant` és
 * `sdk_result` sorból tölti** (6.2 szekció), ez a séma szintjén nem
 * kényszeríthető ki (nincs `CHECK`, ami a `kind` értékétől tenné függővé egy
 * másik oszlop NULL-értékét SQLite-ban gyakorlati módon), a szabályt a
 * normalizáló függvény tartja be (T-003-20).
 */
export const runEventTable = sqliteTable(
  'run_event',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    runId: text('run_id')
      .notNull()
      .references(() => workflowRunTable.id, { onDelete: 'cascade' }),
    stepRunId: text('step_run_id').references(() => stepRunTable.id, { onDelete: 'cascade' }),
    origin: text('origin').notNull(),
    kind: text('kind').notNull(),
    occurredAtMs: integer('occurred_at_ms', { mode: 'timestamp_ms' }).notNull(),
    sdkMessageType: text('sdk_message_type'),
    sdkMessageSubtype: text('sdk_message_subtype'),
    sdkSessionId: text('sdk_session_id'),
    sdkUuid: text('sdk_uuid'),
    parentToolUseId: text('parent_tool_use_id'),
    toolName: text('tool_name'),
    toolUseId: text('tool_use_id'),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    cacheReadInputTokens: integer('cache_read_input_tokens'),
    cacheCreationInputTokens: integer('cache_creation_input_tokens'),
    numTurns: integer('num_turns'),
    payload: text('payload', { mode: 'json' }).$type<unknown>().notNull(),
  },
  (table) => [
    index('run_event_run_id_idx').on(table.runId, table.id),
    index('run_event_step_run_id_idx').on(table.stepRunId, table.id),
    // F-10: UNIQUE indexben minden NULL érték különbözőnek számít, tehát a
    // motor eseményeknek (nincs sdk_uuid) tetszőleges sok NULL sora
    // beszúrható marad ugyanahhoz a run_id-hez; az index kizárólag a
    // (run_id, sdk_uuid) NEM-NULL párok egyediségét kényszeríti ki, az
    // idempotens hozzáfűzés kulcsaként (6.5 szekció).
    uniqueIndex('run_event_run_uuid_uq').on(table.runId, table.sdkUuid),
  ],
);
