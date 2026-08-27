import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { describeError, type Outcome } from '@easter-workflow-builder/core';

/**
 * A commitolt SQL migrációk lefuttatása a `drizzle-orm/better-sqlite3/migrator`
 * szinkron `migrate()` hívásával (F-18), `Outcome` hibaágra burkolva: a
 * migráció hibája nem repülhet ki kivételként a csomag rétegéből (SPEC-003
 * 9.1 szekció). A `migrationsFolder` explicit paraméter, nem beégetett
 * alapérték, hogy a hívó (és a teszt) tetszőleges útvonalat adhasson meg.
 */
export function migrateDatabase(database: BetterSQLite3Database, migrationsFolder: string): Outcome<void> {
  try {
    migrate(database, { migrationsFolder });
    return { kind: 'ok', value: undefined };
  } catch (error) {
    return {
      kind: 'error',
      message: `A migrációk futtatása sikertelen: ${describeError(error)}`,
    };
  }
}
