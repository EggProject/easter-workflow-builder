import type { ErrorHandlerNodeConfig } from '@easter-workflow-builder/db';
import type { EngineErrorKind } from '../engine-error/engine-error-kind.ts';
import type { RetryDecision } from './retry-decision.ts';

export interface ResolveRetryDecisionInput {
  readonly config: ErrorHandlerNodeConfig;

  /**
   * A hibát adó lépés `error_kind` értéke (SPEC-004 8.2 bevezető).
   */
  readonly failedErrorKind: EngineErrorKind;

  /**
   * Az az `attempt` sorszám, amin a lépés elbukott (SPEC-004 8.2 bevezető).
   */
  readonly failedAttempt: number;
}

/**
 * Az `error_handler` node kísérlet vezérlésének **teljes** döntése, tiszta
 * függvényben (SPEC-004 8.2 1 ... 4. pont). Adatbázist nem érint, portot nem
 * hív, időt nem mér: a `clock.sleep` hívás és a `step_run` írás a
 * végrehajtóé (`execute-error-handler.ts`).
 *
 * A három szűrő sorrendje kötött, mert egymás előfeltételei:
 *
 * 1. **`handledErrorKinds` szűrés.** Az **üres lista minden hibaosztályt
 *    jelent**, mert a mező szűrő, és egy mindent kizáró üres szűrő
 *    használhatatlanná tenné a node-ot (8.2 1. pont, szó szerint). Nem üres
 *    és nem illeszkedő lista esetén a kezelő nem jár el.
 * 2. **Kísérletszám.** `attempt >= maxAttempts` esetén minden kísérlet
 *    elfogyott (8.2 2. pont). Ez a szűrés a `backoffMs` olvasása **előtt**
 *    áll, mert a lista csak `maxAttempts - 1` elemet köteles hordozni
 *    (`validateErrorHandlerBackoff`), tehát az utolsó kísérletnél nincs is mit
 *    olvasni.
 * 3. **A várakozás hossza.** A `backoffMs[attempt - 1]` elem, ahol az `attempt`
 *    egytől indul (8.2 3. pont). Ismétlési szabályt nem találunk ki: ha az
 *    elem hiányzik, a döntés `missing_backoff`, nem egy kitalált szám.
 */
export function resolveRetryDecision(input: ResolveRetryDecisionInput): RetryDecision {
  const { config, failedAttempt } = input;

  if (config.handledErrorKinds.length > 0 && !config.handledErrorKinds.includes(input.failedErrorKind)) {
    return { kind: 'unhandled_error_kind' };
  }

  if (failedAttempt >= config.maxAttempts) {
    return { kind: 'attempts_exhausted' };
  }

  const backoffMs = config.backoffMs[failedAttempt - 1];
  if (backoffMs === undefined) {
    return { kind: 'missing_backoff' };
  }

  return { kind: 'retry', backoffMs, nextAttempt: failedAttempt + 1 };
}
