import SqliteDatabase from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { migrateDatabase } from '../../migration/migrate-database.ts';
import { MIGRATIONS_FOLDER } from '../../migration/migrations-folder.ts';
import { graphSnapshotTable } from './graph-snapshot.ts';

/**
 * A `graph_snapshot_no_update` adatbázis szintű trigger, a SPEC-003 5.5
 * szekció 2. pontjának és a 19. elfogadási kritériumnak a próbája
 * (docs/research/2026-08-27-spec003-f1-nyitott-kerdesek.md, O-6 szekció).
 *
 * Az `openDatabase`/`DatabaseContext` felület nem exportálja a nyers
 * `better-sqlite3` handle-t, ezért a teszt saját `better-sqlite3` +
 * `drizzle()` példányt nyit, és a commitolt migrációkat a `migrateDatabase`
 * segéddel futtatja le rajta, ugyanúgy, ahogy az `openDatabase` teszi belül.
 */
describe('graph_snapshot_no_update trigger', () => {
  it('az INSERT és a DELETE sikeres, az UPDATE SQLITE_CONSTRAINT_TRIGGER hibával elbukik', () => {
    const sqlite = new SqliteDatabase(':memory:');
    sqlite.pragma('foreign_keys = ON');
    const database = drizzle(sqlite);
    expect(migrateDatabase(database, MIGRATIONS_FOLDER).kind).toBe('ok');

    database
      .insert(graphSnapshotTable)
      .values({
        hash: 'abc',
        documentVersion: 1,
        document: { version: 1 },
        firstCapturedAtMs: new Date(0),
      })
      .run();

    let caughtError: unknown;
    try {
      sqlite.prepare('UPDATE graph_snapshot SET document_version = ? WHERE hash = ?').run(2, 'abc');
    } catch (error) {
      caughtError = error;
    }

    if (!(caughtError instanceof SqliteDatabase.SqliteError)) {
      throw new TypeError('váratlan hiba típus: SqliteError-t vártunk az UPDATE kísérlettől');
    }
    expect(caughtError.code).toBe('SQLITE_CONSTRAINT_TRIGGER');
    expect(caughtError.message).toBe('graph_snapshot is immutable');

    const rowAfterFailedUpdate = database
      .select()
      .from(graphSnapshotTable)
      .where(eq(graphSnapshotTable.hash, 'abc'))
      .get();
    expect(rowAfterFailedUpdate?.documentVersion).toBe(1);

    database.delete(graphSnapshotTable).where(eq(graphSnapshotTable.hash, 'abc')).run();
    const rowAfterDelete = database.select().from(graphSnapshotTable).where(eq(graphSnapshotTable.hash, 'abc')).get();
    expect(rowAfterDelete).toBeUndefined();

    sqlite.close();
  });
});
