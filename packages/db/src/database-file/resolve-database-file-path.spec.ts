import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveDatabaseFilePath } from './resolve-database-file-path.ts';
import { ENV_EASTER_DB_FILE } from './environment-variable-name.ts';

describe('resolveDatabaseFilePath', () => {
  it('a beállított környezeti változót adja vissza, trimmelve', () => {
    const result = resolveDatabaseFilePath({ [ENV_EASTER_DB_FILE]: ' /var/data/easter.sqlite ' }, '/repo');
    expect(result).toBe('/var/data/easter.sqlite');
  });

  it('a fejlesztői alapértelmezést adja, ha a változó nincs beállítva', () => {
    const result = resolveDatabaseFilePath({}, '/repo');
    expect(result).toBe(path.join('/repo', '.data', 'easter-workflow-builder.sqlite'));
  });

  it('a fejlesztői alapértelmezést adja, ha a változó csak szóközt tartalmaz', () => {
    const result = resolveDatabaseFilePath({ [ENV_EASTER_DB_FILE]: ' '.repeat(3) }, '/repo');
    expect(result).toBe(path.join('/repo', '.data', 'easter-workflow-builder.sqlite'));
  });
});
