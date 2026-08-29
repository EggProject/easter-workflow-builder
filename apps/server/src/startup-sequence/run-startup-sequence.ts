import process from 'node:process';
import { transport as buildPinoTransport } from 'pino';
import type { EnvironmentReader } from '@easter-workflow-builder/core';
import { openDatabase, resolveDatabaseFilePath } from '@easter-workflow-builder/db';
import { buildLogRotationOptions, createServerLogger, type ServerLogger } from '@easter-workflow-builder/logger';
import { readServerConfig, type ServerConfig } from '../server-config/server-config.ts';
import { collectSecretEnvironmentValues } from './collect-secret-environment-values.ts';
import { continueStartupWithDatabase } from './continue-startup-with-database.ts';

/**
 * A 2. lépés loggere (SPEC-006 4.2, 7.3): a `pino.transport()` hívás
 * SZÁNDÉKOSAN itt áll, nem a `logger` csomagban (lásd
 * `packages/logger/src/log-rotation/build-log-rotation-options.ts` fejlécét)
 * - a `log-rotation` téma csak az opció objektumot építi, worker szál
 * indítás nélkül.
 */
function buildLogger(config: ServerConfig, environment: EnvironmentReader): ServerLogger {
  const sink = buildPinoTransport({
    target: 'pino-roll',
    options: buildLogRotationOptions({
      logDirectory: config.logDirectory,
      size: config.logRotationSize,
      frequency: config.logRotationFrequency,
      retainedFileCount: config.logRetainedFileCount,
    }),
  });

  return createServerLogger(
    {
      ...(config.logLevel !== undefined && { level: config.logLevel }),
      secretValues: collectSecretEnvironmentValues(environment),
    },
    sink,
  );
}

/**
 * A szerver indulási sorrendjének 1 ... 3. lépése (SPEC-006 4.1, 4.2, 4.3,
 * 4.4): konfiguráció, logger, adatbázis megnyitás. Mindkét hibaág végleges:
 * naplózás, majd `process.exitCode = 1`, `process.exit()` hívás nélkül
 * (4.4). Sikeres adatbázis nyitás után a 4 ... 7. lépést a
 * `continueStartupWithDatabase` végzi (lásd ott, miért külön fájl). A
 * `main.ts` ezt a függvényt hívja, egyetlen, elágazás nélküli hívásként.
 *
 * A `repoRootDirectory` a `db` csomag `resolveDatabaseFilePath` bemenete: a
 * folyamat induló könyvtára, amiből a fejlesztői alapértelmezett adatbázis
 * fájl útvonala (`.data/easter-workflow-builder.sqlite`) származik, ha az
 * `EASTER_DB_FILE` env változó nincs beállítva.
 */
export async function runStartupSequence(environment: EnvironmentReader, repoRootDirectory: string): Promise<void> {
  // 1. konfiguráció - még nincs logger, a szabványos hibakimenetre írunk.
  const config = readServerConfig(environment);
  if (config.kind === 'error') {
    process.stderr.write(`fatal: ${config.message}\n`);
    process.exitCode = 1;
    return;
  }

  // 2. logger
  const logger = buildLogger(config.value, environment);

  // 3. adatbázis
  const databaseFilePath = resolveDatabaseFilePath(environment, repoRootDirectory);
  const databaseOutcome = openDatabase(databaseFilePath);
  if (databaseOutcome.kind === 'error') {
    logger.fatal({ message: databaseOutcome.message }, 'Az adatbázis megnyitása sikertelen.');
    process.exitCode = 1;
    return;
  }

  await continueStartupWithDatabase(databaseOutcome.value, config.value, logger);
}
