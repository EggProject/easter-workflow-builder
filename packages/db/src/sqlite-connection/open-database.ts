import SqliteDatabase from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { describeError, type Outcome } from '@easter-workflow-builder/core';
import { ensureDatabaseDirectory } from '../database-file/ensure-database-directory.ts';
import type { DatabaseContext } from './database-context.ts';

const DATABASE_CLOSED_MESSAGE =
  'A művelet nem hajtható végre, mert az adatbázis kapcsolat le van zárva (database_closed).';

/**
 * Belső jelzőosztály a tranzakción belüli, `Outcome` hibaágból kiváltott
 * visszagörgetéshez. A `better-sqlite3`/Drizzle tranzakció csak dobott
 * hibára görget vissza (F-4), egy normálisan visszaadott hiba `Outcome`-ot
 * csendben commitolna.
 */
class TransactionRollback extends Error {}

/**
 * Az adatbázis kapcsolat megnyitása a SPEC-003 10.2 szekció sorrendjében: a
 * könyvtár létrehozása, `new Database`, `foreign_keys` pragma, majd
 * `journal_mode = WAL` fájl alapú adatbázison, végül a `drizzle()` bekötés
 * séma objektum nélkül. A migrációk futtatása a `migration` témával bővül
 * (T-003-10).
 */
export function openDatabase(filePath: string): Outcome<DatabaseContext> {
  const directoryOutcome = ensureDatabaseDirectory(filePath);
  if (directoryOutcome.kind === 'error') {
    return directoryOutcome;
  }

  let sqlite: SqliteDatabase.Database;
  try {
    sqlite = new SqliteDatabase(filePath);
  } catch (error) {
    return {
      kind: 'error',
      message: `Nem sikerült megnyitni a(z) ${filePath} adatbázis fájlt: ${describeError(error)}`,
    };
  }

  sqlite.pragma('foreign_keys = ON');
  if (filePath !== ':memory:') {
    sqlite.pragma('journal_mode = WAL');
  }

  const database = drizzle(sqlite);
  let isClosed = false;

  function transaction<TValue>(work: () => Outcome<TValue>): Outcome<TValue> {
    if (isClosed) {
      return { kind: 'error', message: DATABASE_CLOSED_MESSAGE };
    }
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
  }

  function close(): void {
    isClosed = true;
    sqlite.close();
  }

  return { kind: 'ok', value: { transaction, close } };
}
