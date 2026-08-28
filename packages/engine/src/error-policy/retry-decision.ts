/**
 * Az `error_handler` node kísérlet vezérlésének döntése (SPEC-004 8.2 1 ... 4.
 * pont), tiszta függvényből (`resolveRetryDecision`). A döntés végrehajtása -
 * a `step_run` sorok írása, a `clock.sleep` és az esemény kiadás - az
 * `execute-error-handler.ts` dolga; ez a típus csak azt mondja meg, mi
 * történjen.
 *
 * - `unhandled_error_kind`: a `handledErrorKinds` lista nem üres, és nem
 *   tartalmazza a hibaosztályt, tehát a kezelő nem jár el (8.2 1. pont). A
 *   kezelő lépése `failed` állapotban zár `unhandled_error_kind`
 *   hibaosztállyal, és a 8.3 politika következik.
 * - `attempts_exhausted`: `attempt >= maxAttempts`, minden kísérlet elfogyott
 *   (8.2 2. pont). A kezelő lépése `failed` állapotban zár
 *   `retry_attempts_exhausted` hibaosztállyal, és a vezérlés az `exhausted`
 *   élre megy, ha van ilyen.
 * - `retry`: van még kísérlet. A `backoffMs` a `backoffMs[attempt - 1]` elem
 *   (8.2 3. pont), a `nextAttempt` pedig az új `step_run` sor `attempt`
 *   értéke (8.2 4. pont, SPEC-003 4.10: "A retry új sor, nem állapot").
 * - `missing_backoff`: a `backoffMs` listában nincs elem a `attempt - 1`
 *   indexen. **Ezt az ágat a futás indítási validáció kizárja**
 *   (`validateErrorHandlerBackoff`, `insufficient_backoff_list`), tehát éles
 *   futásban nem fordul elő; azért létezik mégis, mert a
 *   `noUncheckedIndexedAccess` fordítói kapcsoló mellett a tömb indexelés
 *   `number | undefined` típusú, és az egyetlen alternatíva egy `!` non-null
 *   assertion lenne, amit a szabálykönyv tilt (`.claude/CLAUDE.md` 5.
 *   szekció). A tiszta függvény önmagában hívható rossz configgal is, tehát
 *   az ág valóban elérhető és tesztelhető - nem "lehetetlen esetre írt
 *   hibakezelés".
 */
export type RetryDecision =
  | { readonly kind: 'unhandled_error_kind' }
  | { readonly kind: 'attempts_exhausted' }
  | { readonly kind: 'missing_backoff' }
  | { readonly kind: 'retry'; readonly backoffMs: number; readonly nextAttempt: number };
