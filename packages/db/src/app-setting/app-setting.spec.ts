import SqliteDatabase from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { describe, expect, it } from 'vitest';
import { migrateDatabase } from '../migration/migrate-database.ts';
import { MIGRATIONS_FOLDER } from '../migration/migrations-folder.ts';
import { appSettingTable } from './app-setting.ts';

/**
 * Az `appSettingTable` séma valós SQLite ellen: a migrált tábla üresen
 * indul (41. kritérium), a `persist_stream_deltas` séma szintű `DEFAULT`
 * hamis (F-28, 56. kritérium), és a `CHECK (id = 1)` (F-15) a `better-sqlite3`
 * `SQLITE_CONSTRAINT_CHECK` hibáját dobja bármilyen más `id` értékre.
 */
describe('appSettingTable', () => {
  it('a migrált adatbázison a tábla üres', () => {
    const sqlite = new SqliteDatabase(':memory:');
    const database = drizzle(sqlite);
    expect(migrateDatabase(database, MIGRATIONS_FOLDER).kind).toBe('ok');

    const rows = database.select().from(appSettingTable).all();
    expect(rows).toStrictEqual([]);

    sqlite.close();
  });

  it('id = 1 sor beszúrható, a persist_stream_deltas séma szintű alapértéke hamis kitöltés nélkül', () => {
    const sqlite = new SqliteDatabase(':memory:');
    const database = drizzle(sqlite);
    migrateDatabase(database, MIGRATIONS_FOLDER);

    database
      .insert(appSettingTable)
      .values({ id: 1, updatedAtMs: new Date(0) })
      .run();

    const row = database.select().from(appSettingTable).where(eq(appSettingTable.id, 1)).get();
    expect(row?.persistStreamDeltas).toBe(false);
    expect(row?.defaultProviderId).toBeNull();

    sqlite.close();
  });

  it('id != 1 beszúrási kísérlet SQLITE_CONSTRAINT_CHECK hibával elbukik', () => {
    const sqlite = new SqliteDatabase(':memory:');
    const database = drizzle(sqlite);
    migrateDatabase(database, MIGRATIONS_FOLDER);

    let caughtError: unknown;
    try {
      database
        .insert(appSettingTable)
        .values({ id: 2, updatedAtMs: new Date(0) })
        .run();
    } catch (error) {
      caughtError = error;
    }

    if (!(caughtError instanceof SqliteDatabase.SqliteError)) {
      throw new TypeError('váratlan hiba típus: SqliteError-t vártunk az id != 1 beszúrási kísérlettől');
    }
    expect(caughtError.code).toBe('SQLITE_CONSTRAINT_CHECK');

    const rows = database.select().from(appSettingTable).all();
    expect(rows).toStrictEqual([]);

    sqlite.close();
  });

  it('a tábla configja tartalmazza az app_setting_id_check CHECK constraintot', () => {
    const [tableCheck] = getTableConfig(appSettingTable).checks;
    expect(tableCheck?.name).toBe('app_setting_id_check');
  });
});
