import SqliteDatabase from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { describe, expect, it } from 'vitest';
import { migrateDatabase } from '../migration/migrate-database.ts';
import { MIGRATIONS_FOLDER } from '../migration/migrations-folder.ts';
import { providerConcurrencyLimitTable } from './provider-concurrency.ts';

/**
 * A `providerConcurrencyLimitTable` séma valós SQLite ellen: a migrált tábla
 * üresen indul (41. kritérium), és a `CHECK (max_concurrent_steps > 0)`
 * (F-15) a `better-sqlite3` `SQLITE_CONSTRAINT_CHECK` hibáját dobja 0 vagy
 * negatív értékre.
 */
describe('providerConcurrencyLimitTable', () => {
  it('a migrált adatbázison a tábla üres', () => {
    const sqlite = new SqliteDatabase(':memory:');
    const database = drizzle(sqlite);
    expect(migrateDatabase(database, MIGRATIONS_FOLDER).kind).toBe('ok');

    const rows = database.select().from(providerConcurrencyLimitTable).all();
    expect(rows).toStrictEqual([]);

    sqlite.close();
  });

  it('pozitív max_concurrent_steps beszúrható', () => {
    const sqlite = new SqliteDatabase(':memory:');
    const database = drizzle(sqlite);
    migrateDatabase(database, MIGRATIONS_FOLDER);

    database
      .insert(providerConcurrencyLimitTable)
      .values({ providerId: 'minimax', maxConcurrentSteps: 3, updatedAtMs: new Date(0) })
      .run();

    const row = database
      .select()
      .from(providerConcurrencyLimitTable)
      .where(eq(providerConcurrencyLimitTable.providerId, 'minimax'))
      .get();
    expect(row?.maxConcurrentSteps).toBe(3);

    sqlite.close();
  });

  it.each([0, -1])('max_concurrent_steps = %i beszúrási kísérlet SQLITE_CONSTRAINT_CHECK hibával elbukik', (value) => {
    const sqlite = new SqliteDatabase(':memory:');
    const database = drizzle(sqlite);
    migrateDatabase(database, MIGRATIONS_FOLDER);

    let caughtError: unknown;
    try {
      database
        .insert(providerConcurrencyLimitTable)
        .values({ providerId: 'minimax', maxConcurrentSteps: value, updatedAtMs: new Date(0) })
        .run();
    } catch (error) {
      caughtError = error;
    }

    if (!(caughtError instanceof SqliteDatabase.SqliteError)) {
      throw new TypeError('váratlan hiba típus: SqliteError-t vártunk a nem pozitív beszúrási kísérlettől');
    }
    expect(caughtError.code).toBe('SQLITE_CONSTRAINT_CHECK');

    const rows = database.select().from(providerConcurrencyLimitTable).all();
    expect(rows).toStrictEqual([]);

    sqlite.close();
  });

  it('a tábla configja tartalmazza a provider_concurrency_limit_max_concurrent_steps_check CHECK constraintot', () => {
    const [tableCheck] = getTableConfig(providerConcurrencyLimitTable).checks;
    expect(tableCheck?.name).toBe('provider_concurrency_limit_max_concurrent_steps_check');
  });
});
