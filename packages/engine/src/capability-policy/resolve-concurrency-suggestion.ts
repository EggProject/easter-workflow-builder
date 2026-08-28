import type { Fact } from '@easter-workflow-builder/provider-capability';
import { isKnownFact } from '@easter-workflow-builder/provider-capability';

/**
 * Párhuzamossági **javaslat** a beállítás felületnek (SPEC-004 11.3 táblázat
 * 14. sora, leíró mező: `concurrency.measuredMaxConcurrentSteps`):
 *
 * - `known`: a mért érték javaslatként.
 * - `unknown`: nincs javaslat, és a felület ezt kiírja.
 *
 * **Ez javaslat, nem korlátozás.** A tényleges korlátot a felhasználó állítja
 * be a `provider_concurrency_limit` táblában, és ha ott nincs sor, a motor nem
 * alkalmaz korlátot (F-22, SPEC-004 17. szekció 37. kritérium). A motor tehát
 * ebből az értékből sosem csinál alapértelmezett korlátot; a szabályozó a
 * `concurrency-gate` téma dolga (T-005-18), a javaslat kiadása pedig a
 * `suggestedConcurrencyLimit` motor műveleté (T-005-28).
 *
 * A mért szám korlátait a leíró mező saját dokumentációja hordozza (a mérés
 * adhat alsó korlátot is, ha nem a provider korlátja lépett életbe); a motor a
 * számot nem értelmezi újra, és nem nevez meg providert.
 */
export function resolveConcurrencySuggestion(measuredMaxConcurrentSteps: Fact<number>): number | undefined {
  return isKnownFact(measuredMaxConcurrentSteps) ? measuredMaxConcurrentSteps.value : undefined;
}
