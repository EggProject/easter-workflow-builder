import type { ShutdownDependencies } from './run-shutdown-sequence.ts';
import { runShutdownSequence } from './run-shutdown-sequence.ts';

/**
 * Egyetlen leállás idempotens végrehajtása (SPEC-006 8.2, "a második jel nem
 * gyorsítja fel a leállást"). Az első hívás elindítja a `runShutdownSequence`-t,
 * minden további hívás ugyanazt a folyamatban lévő vagy már lezárt Promise-t
 * adja vissza, tehát a `server.close()`/`database.close()` sosem fut le
 * kétszer. Külön, közvetlenül tesztelhető függvényként áll, hogy a jelkezelő
 * regisztráció (`register-shutdown-signal-handlers.ts`) ne hordozzon saját,
 * a tesztből nehezen elérhető állapotot.
 */
export function createIdempotentShutdownHandler(dependencies: ShutdownDependencies): () => Promise<number> {
  let shutdownPromise: Promise<number> | undefined;

  return () => {
    shutdownPromise ??= runShutdownSequence(dependencies);
    return shutdownPromise;
  };
}
