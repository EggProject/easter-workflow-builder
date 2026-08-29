import type { Server } from 'node:http';
import type { DatabaseContext } from '@easter-workflow-builder/db';
import type { Engine } from '@easter-workflow-builder/engine';
import type { ServerLogger } from '@easter-workflow-builder/logger';

/**
 * A szabályos leállás bemenete: a leállítandó erőforrások (SPEC-006 8.1).
 */
export interface ShutdownDependencies {
  readonly server: Server;
  readonly engine: Engine;
  readonly database: DatabaseContext;
  readonly logger: ServerLogger;
}

function closeHttpServer(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => {
      resolve();
    });
  });
}

/**
 * A szabályos leállás 2 ... 6. lépése (SPEC-006 8.1, 8.2). A `server.close()`
 * után nem jön be új kapcsolat, a `closeAllConnections()` a fennmaradt
 * kapcsolatokat zárja, majd a motor és az adatbázis zár, ebben a sorrendben.
 * A 3. lépés ("minden SSE nyelő lezárása") ebben a verzióban nem létezik: a
 * stream réteg (`stream-registry`/`stream-connection`) nem készült el - ez
 * dokumentált, nyitott hiány (lásd a záró jelentés hiánylistáját), a lépés
 * emiatt kimarad, nem hamisan sikeresre írt.
 *
 * A visszatérési érték a kilépési kód (SPEC-006 8.2 7. lépés): `0`, ha minden
 * lépés sikerült, `1`, ha az `engine.shutdown()` hibaágat adott. A
 * `process.exitCode` beállítása a hívó (`register-shutdown-signal-handlers.ts`)
 * dolga, ez a függvény nem nyúl a globális `process` objektumhoz.
 */
export async function runShutdownSequence(dependencies: ShutdownDependencies): Promise<number> {
  const { server, engine, database, logger } = dependencies;

  logger.info('A szerver leállása elkezdődött.');
  await closeHttpServer(server);
  server.closeAllConnections();

  const shutdownResult = await engine.shutdown();
  if (shutdownResult.kind === 'error') {
    logger.error({ message: shutdownResult.message }, 'A motor leállása hibával zárult.');
    database.close();
    logger.info('A szerver leállt.');
    return 1;
  }

  logger.info(
    { interruptedRunCount: shutdownResult.value.interruptedRunCount },
    'A motor leállt, a megszakított futások száma naplózva.',
  );
  database.close();
  logger.info('A szerver leállt.');
  return 0;
}
