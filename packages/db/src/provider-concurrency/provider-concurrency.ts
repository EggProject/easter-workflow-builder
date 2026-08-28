import { sql } from 'drizzle-orm';
import { check, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * A `provider_concurrency_limit` tábla (SPEC-003 4.14 szekció, 11. szekció,
 * a 4. user döntés). Providerenként egy sor: a `max_concurrent_steps`
 * mennyi agent lépés futhat egyszerre az adott provider ellen. Nincs idegen
 * kulcsa és nem mutat rá idegen kulcs máshonnan (3. szekció, "Az `app_setting`
 * és a `provider_concurrency_limit` a rajzon kapcsolat nélkül áll").
 *
 * **A `CHECK (max_concurrent_steps > 0)`** (F-15) a `setLimit` egyetlen
 * védelme érvénytelen érték ellen: a repository nem duplikálja ezt a
 * szabályt TypeScript oldalon, hanem elkapja a `better-sqlite3`
 * `SQLITE_CONSTRAINT_CHECK` hibáját (`provider-concurrency-repository.ts`,
 * `setLimit` dokumentációja).
 *
 * **A migráció üresen indul, alapérték nélkül** (41. kritérium, 11. szekció:
 * "Alapértéket nem szállítunk"). Amíg egy providerhez nincs sor, a motor nem
 * alkalmaz saját korlátot (11. szekció).
 */
export const providerConcurrencyLimitTable = sqliteTable(
  'provider_concurrency_limit',
  {
    providerId: text('provider_id').primaryKey(),
    maxConcurrentSteps: integer('max_concurrent_steps').notNull(),
    updatedAtMs: integer('updated_at_ms', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [check('provider_concurrency_limit_max_concurrent_steps_check', sql`${table.maxConcurrentSteps} > 0`)],
);
