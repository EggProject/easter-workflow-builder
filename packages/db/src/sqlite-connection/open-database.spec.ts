import SqliteDatabase from 'better-sqlite3';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase } from './open-database.ts';
import type { DatabaseContext } from './database-context.ts';

const cleanupDirectories: string[] = [];

afterEach(() => {
  for (const directory of cleanupDirectories) {
    rmSync(directory, { recursive: true, force: true });
  }
  cleanupDirectories.length = 0;
});

function openOrThrow(filePath: string): DatabaseContext {
  const outcome = openDatabase(filePath);
  if (outcome.kind !== 'ok') {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

describe('openDatabase', () => {
  it(':memory: adatbázison sikeresen megnyit, és a tranzakció visszaadja az értéket', () => {
    const context = openOrThrow(':memory:');
    const result = context.transaction<number>(() => ({ kind: 'ok', value: 42 }));
    expect(result).toStrictEqual({ kind: 'ok', value: 42 });
    context.close();
  });

  it('fájl alapú adatbázison létrehozza a hiányzó könyvtárat és WAL módra állít', () => {
    const baseDirectory = mkdtempSync(path.join(tmpdir(), 'easter-db-open-'));
    cleanupDirectories.push(baseDirectory);
    const filePath = path.join(baseDirectory, 'nested', 'easter.sqlite');

    const context = openOrThrow(filePath);
    context.close();

    // A journal_mode a WAL bekapcsolása után az adatbázis fájlban tárolt,
    // perzisztens tulajdonság (nem kapcsolatonkénti, mint a foreign_keys),
    // ezért egy friss, második kapcsolat is `wal` módot lát (F-6).
    const reopened = new SqliteDatabase(filePath);
    const journalMode = reopened.pragma('journal_mode', { simple: true });
    reopened.close();
    expect(journalMode).toBe('wal');
  });

  it('hibaágat ad, ha a könyvtár nem hozható létre', () => {
    const baseDirectory = mkdtempSync(path.join(tmpdir(), 'easter-db-open-'));
    cleanupDirectories.push(baseDirectory);
    const notADirectory = path.join(baseDirectory, 'nem-konyvtar');
    writeFileSync(notADirectory, '');
    const filePath = path.join(notADirectory, 'alkonyvtar', 'easter.sqlite');

    const outcome = openDatabase(filePath);
    expect(outcome.kind).toBe('error');
  });

  it('hibaágat ad, ha a fájl útvonal nem nyitható meg adatbázisként', () => {
    const baseDirectory = mkdtempSync(path.join(tmpdir(), 'easter-db-open-'));
    cleanupDirectories.push(baseDirectory);
    const directoryAsFilePath = path.join(baseDirectory, 'ez-egy-konyvtar');
    mkdirSync(directoryAsFilePath);

    const outcome = openDatabase(directoryAsFilePath);
    expect(outcome.kind).toBe('error');
  });

  it('hibaágat ad és lezárja a kapcsolatot, ha a migráció sikertelen', () => {
    const baseDirectory = mkdtempSync(path.join(tmpdir(), 'easter-db-open-'));
    cleanupDirectories.push(baseDirectory);
    const filePath = path.join(baseDirectory, 'easter.sqlite');

    // A drizzle-orm migrate() a saját `__drizzle_migrations` könyvelő
    // tábláját olvassa vissza a `hash` oszloppal (sqlite-core dialect.js).
    // Egy előre, hiányos sémával létrehozott azonos nevű tábla ezt a
    // SELECT-et valós SQLite hibára futtatja, tehát ez a teszt a
    // `migrationOutcome.kind === 'error'` ágat mock nélkül, a nyilvános
    // `openDatabase` API-n keresztül éri el.
    const preSeeded = new SqliteDatabase(filePath);
    preSeeded.exec('CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY)');
    preSeeded.close();

    const outcome = openDatabase(filePath);
    expect(outcome.kind).toBe('error');
  });

  it('database_closed hibaágat ad, ha a zárás után hívjuk a tranzakciót', () => {
    const context = openOrThrow(':memory:');
    context.close();
    const result = context.transaction(() => ({ kind: 'ok' as const, value: 1 }));
    expect(result.kind).toBe('error');
    if (result.kind !== 'error') {
      throw new Error('hibaágat vártunk');
    }
    expect(result.message).toContain('database_closed');
  });

  it('a work() hibaága visszagörgeti a tranzakciót és ugyanazt a hibaüzenetet adja', () => {
    const context = openOrThrow(':memory:');
    const result = context.transaction(() => ({ kind: 'error' as const, message: 'szándékos teszt hiba' }));
    expect(result).toStrictEqual({ kind: 'error', message: 'szándékos teszt hiba' });
    context.close();
  });

  it('a work()-ben dobott, nem tranzakciós hiba is Outcome hibaágra képződik', () => {
    const context = openOrThrow(':memory:');
    const result = context.transaction<number>(() => {
      throw new Error('váratlan kivétel');
    });
    expect(result.kind).toBe('error');
    if (result.kind !== 'error') {
      throw new Error('hibaágat vártunk');
    }
    expect(result.message).toContain('váratlan kivétel');
    context.close();
  });
});
