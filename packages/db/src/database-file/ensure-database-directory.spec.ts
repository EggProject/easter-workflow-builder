import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ensureDatabaseDirectory } from './ensure-database-directory.ts';

const cleanupDirectories: string[] = [];

afterEach(() => {
  for (const directory of cleanupDirectories) {
    rmSync(directory, { recursive: true, force: true });
  }
  cleanupDirectories.length = 0;
});

describe('ensureDatabaseDirectory', () => {
  it('nem csinál semmit :memory: útvonalon', () => {
    const result = ensureDatabaseDirectory(':memory:');
    expect(result).toStrictEqual({ kind: 'ok', value: undefined });
  });

  it('létrehozza a hiányzó könyvtárat', () => {
    const baseDirectory = mkdtempSync(path.join(tmpdir(), 'easter-db-test-'));
    cleanupDirectories.push(baseDirectory);
    const filePath = path.join(baseDirectory, 'nested', 'deeper', 'easter.sqlite');

    expect(existsSync(path.join(baseDirectory, 'nested', 'deeper'))).toBe(false);
    const result = ensureDatabaseDirectory(filePath);
    expect(result).toStrictEqual({ kind: 'ok', value: undefined });
    expect(existsSync(path.join(baseDirectory, 'nested', 'deeper'))).toBe(true);
  });

  it('hibaágat ad, ha a könyvtár nem hozható létre', () => {
    const baseDirectory = mkdtempSync(path.join(tmpdir(), 'easter-db-test-'));
    cleanupDirectories.push(baseDirectory);
    const notADirectory = path.join(baseDirectory, 'nem-konyvtar');
    writeFileSync(notADirectory, '');
    const filePath = path.join(notADirectory, 'alkonyvtar', 'easter.sqlite');

    const result = ensureDatabaseDirectory(filePath);
    expect(result.kind).toBe('error');
    if (result.kind !== 'error') {
      throw new Error('hibaágat vártunk');
    }
    expect(result.message).toContain(notADirectory);
  });
});
