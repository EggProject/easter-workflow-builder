import SqliteDatabase from 'better-sqlite3';
import { describeError } from '@easter-workflow-builder/core';

/**
 * A `transaction()` (`open-database.ts`) általános `catch` ágának hibaüzenet-
 * fordítása (SPEC-003 12.4 szekció, 40. kritérium, T-003-28 átvizsgálás).
 *
 * **Miért kell ez a fordítás.** A `packages/db/CLAUDE.md` "`Outcome` hibaosztály
 * konvenció" szakasza szerint minden hibaosztály neve szó szerint, zárójelben
 * szerepel az emberi nyelvű üzenetben (pl. "... (database_closed)."), hogy a
 * tesztek stabilan `.toContain(...)` tudjanak rá ellenőrizni. A `transaction()`
 * eddig ezt a mintát a saját, dobott hibáira (`database_closed`) és a
 * visszagörgetett `TransactionRollback`-ra betartotta, de a fallback ágon
 * (`describeError(error)`) egy `better-sqlite3` idegen kulcs sértés
 * (`SQLITE_CONSTRAINT_FOREIGNKEY`) nyers `Error.message`-e ment tovább,
 * nevesítés nélkül.
 *
 * **Csak azt az egy hibakódot fordítja, amit a hívó nem fordított már le.** A
 * `duplicate_event` (`run-event-repository.ts`), az `invalid_max_concurrent_steps`
 * (`provider-concurrency-repository.ts`) és a `graph_snapshot` trigger
 * (`SQLITE_CONSTRAINT_TRIGGER`) saját, specifikusabb repository szintű `catch`
 * ágban dől el, MIELŐTT a hiba idáig jutna - ezekhez a kódokhoz itt nincs eset,
 * tehát a `describeError(error)` fallback változatlanul viszi tovább őket
 * (nincs ütközés a meglévő, specifikusabb fordítással).
 *
 * **Csak a Drizzle TÍPUSOS insert-builder közvetlen `SqliteError`-ját kapja el**
 * (ugyanaz a hívási minta, mint a `provider-concurrency-repository.ts`
 * `setLimit`-jében a `SQLITE_CONSTRAINT_CHECK`-nél): a `workflow-repository.ts`
 * `replaceGraph`-ja `.insert(workflowEdgeTable).values(...).run()` alakban ír,
 * ami a nyers hibát közvetlenül dobja, becsomagolás nélkül.
 */
export function describeTransactionError(error: unknown): string {
  if (error instanceof SqliteDatabase.SqliteError && error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    return `${describeError(error)} (foreign_key_violation)`;
  }
  return describeError(error);
}
