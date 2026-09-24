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
 * A szabályos leállás 2 ... 7. lépése (SPEC-006 8.1, 8.2), ebben a sorrendben:
 *
 * 2. `server.close()`: új kapcsolat nem jön be, a tétlen kapcsolatok
 *    lezárulnak. A visszahívását itt még NEM várjuk meg: az csak akkor fut
 *    le, amikor minden kapcsolat véget ért, a nyitott SSE kapcsolat viszont
 *    magától sosem ér véget, tehát a várakozás a leállást elakasztaná
 *    (SPEC-006 8.2, mérve).
 * 3. `engine.shutdown()`: minden futás leáll, és a futásonként beírt
 *    `run_interrupted` esemény élőben is kimegy. Ezért áll a motor az SSE
 *    nyelők lezárása ELŐTT: lezárt kapcsolaton a lezáró keret nem érné el a
 *    klienst.
 * 4 ... 5. A nyitott SSE nyelők (`streamRegistry.closeAllConnections()`),
 *    majd a maradék kapcsolatok (`server.closeAllConnections()`) zárása.
 * 6. A 2. lépés visszahívásának megvárása.
 * 7. `database.close()`, a motor után, mert a `shutdown` még ír.
 *
 * A visszatérési érték a kilépési kód (8. lépés): `0`, ha minden lépés
 * sikerült, `1`, ha az `engine.shutdown()` hibaágat adott. A
 * `process.exitCode` beállítása a hívó (`register-shutdown-signal-handlers.ts`)
 * dolga, ez a függvény nem nyúl a globális `process` objektumhoz.
 */
export async function runShutdownSequence(dependencies: ShutdownDependencies): Promise<number> {
  const { server, engine, database, logger, streamRegistry } = dependencies;

  logger.info('A szerver leállása elkezdődött.');
  const httpServerClosed = closeHttpServer(server);

  const shutdownResult = await engine.shutdown();

  streamRegistry.closeAllConnections();
  server.closeAllConnections();
  await httpServerClosed;

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
