import { sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { Outcome } from '@easter-workflow-builder/core';
import type { RunEventKind } from '../event-kind/run-event-kind.ts';

/**
 * Egy motor eredetű (`origin = 'engine'`) `run_event` sor beszúrásához
 * szükséges összes érték, az `id` (autoincrement) és az `origin` (mindig
 * `'engine'`, itt szó szerint beégetve) kivételével.
 */
export interface EngineEventRowValues {
  readonly runId: string;
  readonly stepRunId: string | null;
  readonly kind: RunEventKind;
  readonly occurredAtMs: Date;
  readonly payload: unknown;
}

function notFoundMessage(runId: string): string {
  return `A(z) "${runId}" azonosítójú futás nem található (not_found).`;
}

/**
 * Egyetlen `INSERT INTO run_event ... SELECT ... FROM workflow_run WHERE id
 * = :run_id` utasítás (SPEC-003 6.2 szekció mezőkészlete). **Plain,
 * tranzakció nélküli segédfüggvény**: a hívó (a
 * `RunEventRepository.appendEngineEvent`, VAGY a
 * `WorkflowRunRepository.startRun`) MÁR AKTÍV TRANZAKCIÓBAN hívja - ez a
 * függvény maga nem nyit tranzakciót. Ez teszi lehetővé, hogy a `startRun` a
 * `run_started` eseményt ugyanabban a tranzakcióban írja be, mint a futás
 * sorát, `better-sqlite3`/Drizzle beágyazott `transaction()` hívás nélkül
 * (SPEC-003 9.2 szekció, T-003-21, a T-003-16 "NYITOTT PONT" kommentjének
 * lezárása).
 *
 * **Nincs delta kapcsoló ellenőrzés a `WHERE` feltételben.** A SPEC-003 6.6
 * szekció "Melyik esemény fajták esnek a kapcsoló alá" alszekciója szerint a
 * kapcsoló KIZÁRÓLAG a `sdk_stream_event` `kind` értékre hat; a motor eredetű
 * `kind` értékek (`run_started`, `step_started`, ...) sosem esnek alá. A
 * gated SQL-t (`AND (:kind <> 'sdk_stream_event' OR persisted_stream_deltas =
 * 1)`) ezért csak a `run-event-repository.ts` `appendSdkEvent`-je adja hozzá,
 * ahol ez valódi, mindkét ágon tesztelhető elágazás - itt a gate mindig igaz
 * lenne, tehát a hozzáadása egy soha nem futó ágat vinne be a kódba, amit a
 * 100 százalékos lefedettségi küszöb (SPEC-003 12.4 szekció) nem engedne meg.
 * Emiatt ez a függvény és az `appendSdkEvent` belső `insertSdkEventRow`
 * segédje szándékosan KÉT KÜLÖN, nem megosztott SQL utasítás, nem egy közös,
 * kapcsolóra elágazó függvény.
 *
 * Nulla módosított sor csak egy okból lehet: a `runId` nem létezik a
 * `workflow_run` táblában (`not_found`). A payload JSON szerializálása kézi
 * (`JSON.stringify`), mert a `run_event.payload` oszlop beszúrása itt nyers
 * SQL-lel történik, a Drizzle `mode: 'json'` `mapToDriverValue`-ja
 * megkerülve (ugyanaz az indok, mint a `workflow-run-repository.ts` `startRun`
 * gráf pillanatkép beszúrásánál: a cél egy `FROM workflow_run WHERE id = ...`
 * feltételes `INSERT ... SELECT`, amit a Drizzle típusos `insert().values()`
 * API-ja nem tud kifejezni).
 */
export function insertEngineEventRow(
  database: BetterSQLite3Database,
  values: EngineEventRowValues,
): Outcome<{ readonly eventId: number }> {
  const payloadJson = JSON.stringify(values.payload);
  const result = database.run(sql`
    INSERT INTO run_event (run_id, step_run_id, origin, kind, occurred_at_ms, payload)
    SELECT ${values.runId}, ${values.stepRunId}, 'engine', ${values.kind}, ${values.occurredAtMs.getTime()}, ${payloadJson}
      FROM workflow_run
     WHERE id = ${values.runId}
  `);

  if (result.changes === 0) {
    return { kind: 'error', message: notFoundMessage(values.runId) };
  }

  return { kind: 'ok', value: { eventId: Number(result.lastInsertRowid) } };
}
