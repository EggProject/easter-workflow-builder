import SqliteDatabase from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { describeError, type Outcome } from '@easter-workflow-builder/core';
import { describe, expect, it } from 'vitest';
import { migrateDatabase } from '../migration/migrate-database.ts';
import { MIGRATIONS_FOLDER } from '../migration/migrations-folder.ts';
import { providerConcurrencyLimitTable } from './provider-concurrency.ts';
import {
  createProviderConcurrencyRepository,
  type ProviderConcurrencyRepository,
} from './provider-concurrency-repository.ts';

/**
 * Ugyanaz a minta, mint a `workflow-run/workflow-run-repository.spec.ts`-ben:
 * a `.spec.ts` fájl a `createProviderConcurrencyRepository`-t közvetlenül
 * teszteli, nem az `openDatabase` kompozíción keresztül, hogy legyen
 * közvetlen `database` hozzáférés a korrupt adat szimulációjához.
 */
class TransactionRollback extends Error {}

function makeTransaction(database: BetterSQLite3Database) {
  return function transaction<TValue>(work: () => Outcome<TValue>): Outcome<TValue> {
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
  };
}

function openRepository(): {
  sqlite: SqliteDatabase.Database;
  database: BetterSQLite3Database;
  repository: ProviderConcurrencyRepository;
} {
  const sqlite = new SqliteDatabase(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const database = drizzle(sqlite);
  migrateDatabase(database, MIGRATIONS_FOLDER);
  const repository = createProviderConcurrencyRepository(database, makeTransaction(database));
  return { sqlite, database, repository };
}

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (outcome.kind !== 'ok') {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

function errorOrThrow<TValue>(outcome: Outcome<TValue>): string {
  if (outcome.kind !== 'error') {
    throw new Error('hibaágat vártunk');
  }
  return outcome.message;
}

describe('createProviderConcurrencyRepository', () => {
  describe('readLimit', () => {
    it('null-t ad, ha a providerhez nincs sor (11. szekció, "nincs beállított párhuzamossági korlát")', () => {
      const { sqlite, repository } = openRepository();

      expect(okOrThrow(repository.readLimit('minimax'))).toBeNull();

      sqlite.close();
    });

    it('a beállított korlátot adja vissza', () => {
      const { sqlite, repository } = openRepository();

      okOrThrow(repository.setLimit('minimax', 5));
      expect(okOrThrow(repository.readLimit('minimax'))).toBe(5);

      sqlite.close();
    });
  });

  describe('readAllLimits', () => {
    it('üres térképet ad, ha egyetlen providerhez sincs beállított korlát', () => {
      const { sqlite, repository } = openRepository();

      const limits = okOrThrow(repository.readAllLimits());
      expect(limits.size).toBe(0);

      sqlite.close();
    });

    it('minden beállított providert felsorol', () => {
      const { sqlite, repository } = openRepository();

      okOrThrow(repository.setLimit('minimax', 5));
      okOrThrow(repository.setLimit('claude-subscription', 2));

      const limits = okOrThrow(repository.readAllLimits());
      expect(limits.get('minimax')).toBe(5);
      expect(limits.get('claude-subscription')).toBe(2);
      expect(limits.size).toBe(2);

      sqlite.close();
    });

    it('invalid_provider_id hibaágat ad, ha a tárolt provider_id nem érvényes ProviderId (korrupt adat)', () => {
      const { sqlite, database, repository } = openRepository();
      database
        .insert(providerConcurrencyLimitTable)
        .values({ providerId: 'nem-letezo-provider', maxConcurrentSteps: 3, updatedAtMs: new Date(0) })
        .run();

      expect(errorOrThrow(repository.readAllLimits())).toContain('invalid_provider_id');

      sqlite.close();
    });
  });

  describe('setLimit', () => {
    it('upsert: első hívás létrehozza a sort, a második frissíti', () => {
      const { sqlite, repository } = openRepository();

      okOrThrow(repository.setLimit('minimax', 3));
      expect(okOrThrow(repository.readLimit('minimax'))).toBe(3);

      okOrThrow(repository.setLimit('minimax', 7));
      expect(okOrThrow(repository.readLimit('minimax'))).toBe(7);

      const limits = okOrThrow(repository.readAllLimits());
      expect(limits.size).toBe(1);

      sqlite.close();
    });

    it.each([0, -1])(
      'invalid_max_concurrent_steps hibaágat ad %i értékre, a CHECK constraint megsértésén keresztül',
      (value) => {
        const { sqlite, repository } = openRepository();

        expect(errorOrThrow(repository.setLimit('minimax', value))).toContain('invalid_max_concurrent_steps');
        expect(okOrThrow(repository.readLimit('minimax'))).toBeNull();

        sqlite.close();
      },
    );

    it('nem SQLITE_CONSTRAINT_CHECK jellegű hibát továbbenged, a transaction wrapper alakítja Outcome hibaággá', () => {
      const { sqlite, repository } = openRepository();
      // `PRAGMA query_only = ON` a `SQLITE_READONLY` hibakóddal buktatja meg
      // az INSERT-et (saját mérés), tehát a `setLimit` catch ága a
      // `SQLITE_CONSTRAINT_CHECK` ellenőrzésen elbukik és a `throw error`
      // ágat futtatja (a `CHECK` megsértésétől eltérő hiba nem kaphat
      // `invalid_max_concurrent_steps` címkét).
      sqlite.pragma('query_only = ON');

      const result = repository.setLimit('minimax', 3);
      expect(result.kind).toBe('error');
      expect(errorOrThrow(result)).not.toContain('invalid_max_concurrent_steps');

      sqlite.close();
    });
  });

  describe('clearLimit', () => {
    it('törli a meglévő korlátot', () => {
      const { sqlite, repository } = openRepository();

      okOrThrow(repository.setLimit('minimax', 3));
      okOrThrow(repository.clearLimit('minimax'));

      expect(okOrThrow(repository.readLimit('minimax'))).toBeNull();

      sqlite.close();
    });

    it('nem hiba, ha a sor nem is létezett', () => {
      const { sqlite, repository } = openRepository();

      expect(repository.clearLimit('minimax').kind).toBe('ok');

      sqlite.close();
    });
  });
});
