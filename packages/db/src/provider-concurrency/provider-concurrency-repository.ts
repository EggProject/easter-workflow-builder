import SqliteDatabase from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { isProviderId, type ProviderId } from '@easter-workflow-builder/provider-capability';
import type { Outcome } from '@easter-workflow-builder/core';
import { providerConcurrencyLimitTable } from './provider-concurrency.ts';

/**
 * Ugyanaz az aláírás, mint a `DatabaseContext.transaction` (SPEC-003 9.1
 * szekció). Nem onnan importáljuk, hogy elkerüljük a kört, ugyanaz a minta,
 * mint a `workflow-run-repository.ts`-ben.
 */
type TransactionFunction = <TValue>(work: () => Outcome<TValue>) => Outcome<TValue>;

export interface ProviderConcurrencyRepository {
  readLimit(providerId: ProviderId): Outcome<number | null>;
  readAllLimits(): Outcome<ReadonlyMap<ProviderId, number>>;
  setLimit(providerId: ProviderId, maxConcurrentSteps: number): Outcome<void>;
  clearLimit(providerId: ProviderId): Outcome<void>;
}

/**
 * `packages/db/CLAUDE.md` "Outcome hibaosztály konvenció" szerint: a
 * hibaosztály neve szó szerint, zárójelben áll az emberi nyelvű üzenetben.
 */
export function createProviderConcurrencyRepository(
  database: BetterSQLite3Database,
  transaction: TransactionFunction,
): ProviderConcurrencyRepository {
  /**
   * Nincs sor -> nincs beállított korlát (SPEC-003 11. szekció, "Viselkedés,
   * amíg nincs beállított érték"): a `null` itt valódi adat ("a motor nem
   * alkalmaz saját korlátot"), nem helyőrző.
   */
  function readLimit(providerId: ProviderId): Outcome<number | null> {
    return transaction(() => {
      const row = database
        .select({ maxConcurrentSteps: providerConcurrencyLimitTable.maxConcurrentSteps })
        .from(providerConcurrencyLimitTable)
        .where(eq(providerConcurrencyLimitTable.providerId, providerId))
        .get();
      // eslint-disable-next-line unicorn/no-null -- lásd a fenti indoklást
      return { kind: 'ok', value: row === undefined ? null : row.maxConcurrentSteps };
    });
  }

  /**
   * A `provider_id` oszlopon nincs DB szintű `CHECK` a felsorolt provider
   * azonosítókkal, ezért olvasáskor az `isProviderId` guard szűkíti (SPEC-003
   * 9.4 szekció), ugyanaz a minta, mint a `WorkflowRunRepository`-nál: egy
   * korrupt sor `invalid_provider_id` hibaágat ad, a hívó nem kap csendben
   * hibás kulcsú térképet.
   */
  function readAllLimits(): Outcome<ReadonlyMap<ProviderId, number>> {
    return transaction(() => {
      const rows = database.select().from(providerConcurrencyLimitTable).all();
      const limits = new Map<ProviderId, number>();
      for (const row of rows) {
        if (!isProviderId(row.providerId)) {
          return {
            kind: 'error',
            message: `A provider_concurrency_limit tábla provider_id mezője érvénytelen: "${row.providerId}" (invalid_provider_id).`,
          };
        }
        limits.set(row.providerId, row.maxConcurrentSteps);
      }
      return { kind: 'ok', value: limits };
    });
  }

  /**
   * Upsert `INSERT ... ON CONFLICT(provider_id) DO UPDATE` alakban.
   *
   * **A `max_concurrent_steps > 0` szabály kikényszerítése, a döntés.** A
   * bemeneti `maxConcurrentSteps: number` típusa elvben 0-t vagy negatív
   * számot is hordozhat. A `provider_concurrency_limit` tábla `CHECK
   * (max_concurrent_steps > 0)` constraintje (4.14 szekció, F-15) ezt már
   * adatbázis szinten kizárja: egy sértő `INSERT`/`UPDATE` a `better-sqlite3`
   * `SqliteError`-ját dobja, `code: 'SQLITE_CONSTRAINT_CHECK'` értékkel
   * (ugyanaz a mechanizmus, mint a `graph_snapshot_no_update` triggernél,
   * `graph-snapshot-immutability.spec.ts`). A repository ezt a hibát kapja
   * el, és `invalid_max_concurrent_steps` `Outcome` hibaágra fordítja, nem
   * duplikálja a `> 0` szabályt egy külön TypeScript ellenőrzésben: a
   * `CHECK` az egyetlen igazságforrás, tehát a szabály nem futhat szét a
   * séma és a repository között. Minden más, nem `SQLITE_CONSTRAINT_CHECK`
   * kódú hiba (pl. lezárt kapcsolat) továbbra is kirepül, és a `transaction`
   * wrapper (`open-database.ts`) alakítja `Outcome` hibaággá.
   */
  function setLimit(providerId: ProviderId, maxConcurrentSteps: number): Outcome<void> {
    return transaction(() => {
      const now = new Date();
      try {
        database
          .insert(providerConcurrencyLimitTable)
          .values({ providerId, maxConcurrentSteps, updatedAtMs: now })
          .onConflictDoUpdate({
            target: providerConcurrencyLimitTable.providerId,
            set: { maxConcurrentSteps, updatedAtMs: now },
          })
          .run();
      } catch (error) {
        if (error instanceof SqliteDatabase.SqliteError && error.code === 'SQLITE_CONSTRAINT_CHECK') {
          return {
            kind: 'error',
            message: `A(z) "${providerId}" provider párhuzamossági korlátja érvénytelen: "${String(maxConcurrentSteps)}" nem lehet 0 vagy negatív (invalid_max_concurrent_steps).`,
          };
        }
        throw error;
      }
      return { kind: 'ok', value: undefined };
    });
  }

  /**
   * Törlés, nem hiba, ha a sor nem is létezett (SPEC-003 11. szekció): a
   * hiányzó sor utána is "nincs beállított korlát" állapotot jelent, ami a
   * törlés előtt is igaz lehetett.
   */
  function clearLimit(providerId: ProviderId): Outcome<void> {
    return transaction(() => {
      database
        .delete(providerConcurrencyLimitTable)
        .where(eq(providerConcurrencyLimitTable.providerId, providerId))
        .run();
      return { kind: 'ok', value: undefined };
    });
  }

  return { readLimit, readAllLimits, setLimit, clearLimit };
}
