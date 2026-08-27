import SqliteDatabase from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { getTableConfig, SQLiteColumn } from 'drizzle-orm/sqlite-core';
import { describe, expect, it } from 'vitest';
import { migrateDatabase } from '../migration/migrate-database.ts';
import { MIGRATIONS_FOLDER } from '../migration/migrations-folder.ts';
import { computeSnapshotHash } from './compute-snapshot-hash.ts';
import { graphSnapshotTable } from './graph-snapshot.ts';

/**
 * A `graphSnapshotTable` séma valós SQLite ellen: a commitolt migráció
 * tényleg létrehozza a táblát a séma definícióban leírt oszlopokkal, a
 * `hash` a `document` sha256 lenyomata (SPEC-003 45. kritérium), és a
 * `document_version` oszlopon index áll (SPEC-003 4.9 szekció).
 */
describe('graphSnapshotTable', () => {
  it('ki-be írja a sort, a hash a document oszlop sha256 lenyomata', () => {
    const sqlite = new SqliteDatabase(':memory:');
    const database = drizzle(sqlite);
    expect(migrateDatabase(database, MIGRATIONS_FOLDER).kind).toBe('ok');

    const document = { version: 1, workflow: { id: 'w1' } };
    const canonicalText = JSON.stringify(document);
    const hash = computeSnapshotHash(canonicalText);

    database
      .insert(graphSnapshotTable)
      .values({
        hash,
        documentVersion: 1,
        document,
        firstCapturedAtMs: new Date(0),
      })
      .run();

    const row = database.select().from(graphSnapshotTable).where(eq(graphSnapshotTable.hash, hash)).get();
    expect(row).toStrictEqual({
      hash,
      documentVersion: 1,
      document,
      firstCapturedAtMs: new Date(0),
    });
    expect(computeSnapshotHash(JSON.stringify(row?.document))).toBe(hash);

    sqlite.close();
  });

  it('a document_version oszlopon indexet definiál', () => {
    const [versionIndex] = getTableConfig(graphSnapshotTable).indexes;
    expect(versionIndex?.config.name).toBe('graph_snapshot_version_idx');
    expect(versionIndex?.config.unique).toBe(false);

    const [indexedColumn] = versionIndex?.config.columns ?? [];
    if (!(indexedColumn instanceof SQLiteColumn)) {
      throw new TypeError('váratlan index oszlop típus');
    }
    expect(indexedColumn.name).toBe('document_version');
  });

  it('nincs idegen kulcsa: a graph_snapshot a szülő tábla', () => {
    expect(getTableConfig(graphSnapshotTable).foreignKeys).toStrictEqual([]);
  });
});
