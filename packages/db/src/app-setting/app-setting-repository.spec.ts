import SqliteDatabase from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { describeError, type Outcome } from '@easter-workflow-builder/core';
import { describe, expect, it } from 'vitest';
import { migrateDatabase } from '../migration/migrate-database.ts';
import { MIGRATIONS_FOLDER } from '../migration/migrations-folder.ts';
import { appSettingTable } from './app-setting.ts';
import { createAppSettingRepository, type AppSettingRepository } from './app-setting-repository.ts';

/**
 * Ugyanaz a minta, mint a `workflow-run/workflow-run-repository.spec.ts`-ben:
 * a `.spec.ts` fájl a `createAppSettingRepository`-t közvetlenül teszteli,
 * nem az `openDatabase` kompozíción keresztül, hogy legyen közvetlen
 * `database` hozzáférés a korrupt adat szimulációjához.
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
  repository: AppSettingRepository;
} {
  const sqlite = new SqliteDatabase(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const database = drizzle(sqlite);
  migrateDatabase(database, MIGRATIONS_FOLDER);
  const repository = createAppSettingRepository(database, makeTransaction(database));
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

describe('createAppSettingRepository', () => {
  describe('readSettings', () => {
    it('üres táblán defaultProviderId null és persistStreamDeltas hamis (56. kritérium, 1. ág)', () => {
      const { sqlite, repository } = openRepository();

      const settings = okOrThrow(repository.readSettings());
      expect(settings.defaultProviderId).toBeNull();
      expect(settings.persistStreamDeltas).toBe(false);

      sqlite.close();
    });

    it('invalid_provider_id hibaágat ad, ha a tárolt default_provider_id nem érvényes ProviderId (korrupt adat)', () => {
      const { sqlite, database, repository } = openRepository();
      database
        .insert(appSettingTable)
        .values({ id: 1, defaultProviderId: 'nem-letezo-provider', updatedAtMs: new Date(0) })
        .run();

      expect(errorOrThrow(repository.readSettings())).toContain('invalid_provider_id');

      sqlite.close();
    });
  });

  describe('setDefaultProvider', () => {
    it('üres táblán hozza létre a sort, a persistStreamDeltas a séma szintű hamis alapértéket kapja (56. kritérium, 2. ág)', () => {
      const { sqlite, repository } = openRepository();

      okOrThrow(repository.setDefaultProvider('minimax'));

      const settings = okOrThrow(repository.readSettings());
      expect(settings.defaultProviderId).toBe('minimax');
      expect(settings.persistStreamDeltas).toBe(false);

      sqlite.close();
    });

    it('meglévő sort frissít, a persistStreamDeltas értéke megmarad', () => {
      const { sqlite, repository } = openRepository();

      okOrThrow(repository.setPersistStreamDeltas(true));
      okOrThrow(repository.setDefaultProvider('claude-subscription'));

      const settings = okOrThrow(repository.readSettings());
      expect(settings.defaultProviderId).toBe('claude-subscription');
      expect(settings.persistStreamDeltas).toBe(true);

      sqlite.close();
    });
  });

  describe('setPersistStreamDeltas', () => {
    it('üres táblán hozza létre a sort, a defaultProviderId NULL marad (56. kritérium, 3. ág)', () => {
      const { sqlite, repository } = openRepository();

      okOrThrow(repository.setPersistStreamDeltas(true));

      const settings = okOrThrow(repository.readSettings());
      expect(settings.defaultProviderId).toBeNull();
      expect(settings.persistStreamDeltas).toBe(true);

      sqlite.close();
    });

    it('meglévő sort frissít, a defaultProviderId értéke megmarad', () => {
      const { sqlite, repository } = openRepository();

      okOrThrow(repository.setDefaultProvider('minimax'));
      okOrThrow(repository.setPersistStreamDeltas(true));

      const settings = okOrThrow(repository.readSettings());
      expect(settings.defaultProviderId).toBe('minimax');
      expect(settings.persistStreamDeltas).toBe(true);

      okOrThrow(repository.setPersistStreamDeltas(false));
      const settingsAfter = okOrThrow(repository.readSettings());
      expect(settingsAfter.defaultProviderId).toBe('minimax');
      expect(settingsAfter.persistStreamDeltas).toBe(false);

      sqlite.close();
    });
  });
});
