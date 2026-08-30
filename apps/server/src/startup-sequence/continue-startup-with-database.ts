import process from 'node:process';
import type { DatabaseContext } from '@easter-workflow-builder/db';
import { createEngine, runStartupRecovery } from '@easter-workflow-builder/engine';
import type { ServerLogger } from '@easter-workflow-builder/logger';
import { buildEngineDependencies } from '../engine-assembly/build-engine-dependencies.ts';
import { createRandomUuidIdGenerator } from '../engine-assembly/create-random-uuid-id-generator.ts';
import { createSystemClock } from '../engine-assembly/create-system-clock.ts';
import { buildRouteHandlers } from '../route-registry/build-route-handlers.ts';
import { createHttpServer } from '../http-server/create-http-server.ts';
import { createStreamRegistry } from '../stream-registry/create-stream-registry.ts';
import { registerShutdownSignalHandlers } from '../shutdown-sequence/register-shutdown-signal-handlers.ts';
import type { ServerConfig } from '../server-config/server-config.ts';

/**
 * A szerver indulási sorrendjének 4 ... 7. lépése (SPEC-006 4.1, 4.2, 4.3):
 * helyreállítás, motor összeállítás, HTTP szerver és jelkezelők, majd
 * figyelés. Külön fájlként áll, MÁR MEGNYITOTT `database` paraméterrel (nem
 * fájl útvonallal), hogy a helyreállítás hibaágát egy valódi, dekorált
 * `DatabaseContext`-tel közvetlenül lehessen tesztelni - ugyanaz a minta,
 * mint a `packages/engine` `create-engine.spec.ts` `racyDatabase` tesztje.
 * A `run-startup-sequence.ts` (1 ... 3. lépés, fájlból nyitja az
 * adatbázist) ezt a függvényt hívja a 3. lépés sikere után, elágazás
 * nélkül: minden további hibaág lezárása (napló, `database.close()`,
 * `process.exitCode`) itt történik.
 */
export async function continueStartupWithDatabase(
  database: DatabaseContext,
  config: ServerConfig,
  logger: ServerLogger,
): Promise<void> {
  // 4. helyreállítás
  const recovery = runStartupRecovery(database);
  if (recovery.kind === 'error') {
    logger.fatal({ message: recovery.message }, 'Az indulási helyreállítás sikertelen.');
    database.close();
    process.exitCode = 1;
    return;
  }
  logger.info({ recoveredRunCount: recovery.value.recoveredRunCount }, 'Az indulási helyreállítás lefutott.');

  // 5. motor. Az óra és az azonosító generátor a stream réteggel is megosztott
  // egyetlen példány (SPEC-006 6.1 "Az azonosítót a szerver induláskor egyszer
  // generálja", és egyetlen időforrás a motor és az SSE életben tartás között).
  const clock = createSystemClock();
  const streamRegistry = createStreamRegistry(createRandomUuidIdGenerator());
  const engine = createEngine(buildEngineDependencies(database, streamRegistry, clock));

  // 6. HTTP szerver összeállítása és a jelkezelők felvétele
  const server = createHttpServer({
    handlers: buildRouteHandlers(database, engine, streamRegistry),
    devOrigin: config.devOrigin,
    streamDependencies: {
      database,
      registry: streamRegistry,
      clock,
      keepAliveIntervalMs: config.streamKeepAliveIntervalMs,
    },
  });
  registerShutdownSignalHandlers({ server, engine, database, logger, streamRegistry });

  // 7. figyelés
  await new Promise<void>((resolve) => {
    server.once('error', (error: NodeJS.ErrnoException) => {
      logger.fatal({ code: error.code }, 'A szerver nem tudott elindulni.');
      database.close();
      process.exitCode = 1;
      resolve();
    });
    server.listen(config.port, '127.0.0.1', () => {
      logger.info({ port: config.port }, 'A szerver elindult, kapcsolatot fogad.');
      resolve();
    });
  });
}
