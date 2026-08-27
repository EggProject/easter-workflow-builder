import type { EnvironmentReader } from '@easter-workflow-builder/core';
import { defaultDatabaseFilePath } from './default-database-file-path.ts';
import { ENV_EASTER_DB_FILE } from './environment-variable-name.ts';

/**
 * Az adatbázis fájl útvonalának feloldása: ha az `EASTER_DB_FILE` be van
 * állítva, azt használjuk (trimmelve), különben a fejlesztői alapértelmezés
 * (SPEC-003 10.1 szekció). A `:memory:` érték a hívó felelőssége (teszt
 * környezet), ezt a függvény nem állítja elő.
 */
export function resolveDatabaseFilePath(environment: EnvironmentReader, repoRootDirectory: string): string {
  const rawValue = environment[ENV_EASTER_DB_FILE];
  if (rawValue === undefined || rawValue.trim().length === 0) {
    return defaultDatabaseFilePath(repoRootDirectory);
  }
  return rawValue.trim();
}
