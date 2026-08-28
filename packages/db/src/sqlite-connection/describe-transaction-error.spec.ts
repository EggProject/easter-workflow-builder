import SqliteDatabase from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { describeTransactionError } from './describe-transaction-error.ts';

/**
 * Közvetlen, szintetikus egységteszt (a `run-event/event-record/extract-error-cause.spec.ts`
 * mintáját követve), a `workflow-repository.spec.ts` valós, végponttól
 * végpontig futó idegen kulcs sértéses tesztje MELLETT: itt a szelektivitást
 * (a `SQLITE_CONSTRAINT_FOREIGNKEY`-től eltérő kód érintetlen marad) izoláltan,
 * a `SqliteDatabase.SqliteError` publikus `(message, code)` konstruktorával
 * bizonyítjuk, valós adatbázis nyitása nélkül.
 */
describe('describeTransactionError', () => {
  it('a nyers hibaüzenetet adja vissza, ha a hiba nem SqliteError', () => {
    const error = new Error('valami váratlan hiba');
    expect(describeTransactionError(error)).toBe('valami váratlan hiba');
  });

  it('a nyers hibaüzenetet adja vissza, ha a SqliteError kódja nem SQLITE_CONSTRAINT_FOREIGNKEY', () => {
    const error = new SqliteDatabase.SqliteError('UNIQUE constraint failed', 'SQLITE_CONSTRAINT_UNIQUE');
    expect(describeTransactionError(error)).toBe('UNIQUE constraint failed');
  });

  it('a (foreign_key_violation) jelöléssel egészíti ki az üzenetet SQLITE_CONSTRAINT_FOREIGNKEY kódra', () => {
    const error = new SqliteDatabase.SqliteError('FOREIGN KEY constraint failed', 'SQLITE_CONSTRAINT_FOREIGNKEY');
    expect(describeTransactionError(error)).toBe('FOREIGN KEY constraint failed (foreign_key_violation)');
  });
});
