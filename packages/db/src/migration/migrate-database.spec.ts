import SqliteDatabase from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { isRecord, isString } from '@easter-workflow-builder/typeguards';
import { describe, expect, it } from 'vitest';
import { migrateDatabase } from './migrate-database.ts';
import { MIGRATIONS_FOLDER } from './migrations-folder.ts';

function readTableNames(sqlite: SqliteDatabase.Database): readonly string[] {
  const rows: unknown[] = sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all();
  return rows.map((row) => {
    if (!isRecord(row) || !isString(row['name'])) {
      throw new Error('váratlan sqlite_master sor alak');
    }
    return row['name'];
  });
}

describe('migrateDatabase', () => {
  it('lefuttatja a commitolt migrációkat egy friss :memory: adatbázison', () => {
    const sqlite = new SqliteDatabase(':memory:');
    const database = drizzle(sqlite);

    const result = migrateDatabase(database, MIGRATIONS_FOLDER);
    expect(result).toStrictEqual({ kind: 'ok', value: undefined });
    expect(readTableNames(sqlite)).toStrictEqual([
      '__drizzle_migrations',
      'graph_snapshot',
      'workflow',
      'workflow_edge',
      'workflow_node',
      'workflow_run',
    ]);

    sqlite.close();
  });

  it('hibaágat ad, ha a migrációs mappa nem található', () => {
    const sqlite = new SqliteDatabase(':memory:');
    const database = drizzle(sqlite);

    const result = migrateDatabase(database, '/nem/letezo/migracios/mappa');
    expect(result.kind).toBe('error');

    sqlite.close();
  });
});
