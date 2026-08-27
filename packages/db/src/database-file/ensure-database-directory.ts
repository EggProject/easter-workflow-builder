import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { describeError, type Outcome } from '@easter-workflow-builder/core';

/**
 * Az adatbázis fájlt befogadó könyvtár létrehozása, ha hiányzik. A
 * `:memory:` útvonalon nincs könyvtár, a függvény ilyenkor nem csinál semmit
 * (SPEC-003 10.1 szekció, teszt környezet).
 */
export function ensureDatabaseDirectory(filePath: string): Outcome<void> {
  if (filePath === ':memory:') {
    return { kind: 'ok', value: undefined };
  }
  const directory = path.dirname(filePath);
  try {
    mkdirSync(directory, { recursive: true });
    return { kind: 'ok', value: undefined };
  } catch (error) {
    return {
      kind: 'error',
      message: `Nem sikerült létrehozni a(z) ${directory} könyvtárat az adatbázis fájlhoz: ${describeError(error)}`,
    };
  }
}
