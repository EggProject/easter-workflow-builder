import type { Server } from 'node:http';
import type { DatabaseContext } from '@easter-workflow-builder/db';
import type { Engine } from '@easter-workflow-builder/engine';
import type { ServerLogger } from '@easter-workflow-builder/logger';
import type { StreamRegistry } from '../stream-registry/create-stream-registry.ts';

/**
 * A szabályos leállás bemenete: a leállítandó erőforrások (SPEC-006 8.1).
 */
export interface ShutdownDependencies {
  readonly server: Server;
  readonly engine: Engine;
  readonly database: DatabaseContext;
  readonly logger: ServerLogger;
  readonly streamRegistry: StreamRegistry;
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
 * után nem jön be új kapcsolat; a 3. lépés minden nyitott SSE nyelőt lezár
 * (`streamRegistry.closeAllConnections()`, SPEC-006 8.2 3. lépés) - ez
 * `engine.shutdown()` ELŐTT fut, mert a stream kapcsolatok sosem járnak le
 * maguktól, és a `server.close()` visszahívása nélkülük soha nem futna le. A
 * `closeAllConnections()` a fennmaradt (idle) kapcsolatokat zárja, majd a
 * motor és az adatbázis zár, ebben a sorrendben.
 *
 * A visszatérési érték a kilépési kód (SPEC-006 8.2 7. lépés): `0`, ha minden
 * lépés sikerült, `1`, ha az `engine.shutdown()` hibaágat adott. A
 * `process.exitCode` beállítása a hívó (`register-shutdown-signal-handlers.ts`)
 * dolga, ez a függvény nem nyúl a globális `process` objektumhoz.
 */
export async function runShutdownSequence(dependencies: ShutdownDependencies): Promise<number> {
  const { server, engine, database, logger, streamRegistry } = dependencies;

  logger.info('A szerver leállása elkezdődött.');
  await closeHttpServer(server);
  streamRegistry.closeAllConnections();
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
