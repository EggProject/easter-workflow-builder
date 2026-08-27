import path from 'node:path';

/**
 * A fejlesztői alapértelmezett adatbázis fájl útvonala, ha az
 * `EASTER_DB_FILE` környezeti változó nincs beállítva (SPEC-003 10.1
 * szekció).
 */
export function defaultDatabaseFilePath(repoRootDirectory: string): string {
  return path.join(repoRootDirectory, '.data', 'easter-workflow-builder.sqlite');
}
