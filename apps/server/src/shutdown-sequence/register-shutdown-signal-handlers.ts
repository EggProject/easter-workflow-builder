import process from 'node:process';
import type { ShutdownDependencies } from './run-shutdown-sequence.ts';
import { createIdempotentShutdownHandler } from './create-idempotent-shutdown-handler.ts';

/**
 * A két jelkezelő felvétele (SPEC-006 4.2 6. lépés, 8.2 1. lépés). A
 * `SIGINT` és a `SIGTERM` ugyanazt az idempotens leállító függvényt hívja,
 * majd a visszaadott kilépési kódot a `process.exitCode`-ba írja
 * (`process.exit()` hívás nélkül, SPEC-006 4.4).
 */
export function registerShutdownSignalHandlers(dependencies: ShutdownDependencies): void {
  const shutdown = createIdempotentShutdownHandler(dependencies);

  function onSignal(): void {
    void shutdown().then((exitCode) => {
      process.exitCode = exitCode;
    });
  }

  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);
}
