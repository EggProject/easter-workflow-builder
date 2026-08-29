/**
 * Az `Engine.suggestedConcurrencyLimit` visszatérési értéke (SPEC-004 3.1
 * `Engine` felület, 7.3 szekció, PLAN-005 T-005-28).
 *
 * **Ez javaslat, nem korlát.** A tényleges korlátot a felhasználó menti el a
 * `provider_concurrency_limit` táblába (`ConcurrencyLimitLookup`,
 * `concurrency-gate` téma); ez a művelet csak a beállítás felületnek ad
 * ajánlást, a leíró `concurrency.measuredMaxConcurrentSteps` mezőjéből
 * (`resolveConcurrencySuggestion`, `capability-policy` téma).
 *
 * A `suggestedLimit` `undefined`, ha a leíró mezője `unknown` (nincs mérés).
 * A `note` mindig kitöltött: `known` esetén a SPEC-004 7.3 szekció szerinti
 * figyelmeztetést hordozza ("a javasolt érték alsó korlát, nem a provider
 * tényleges határa"), `unknown` esetén azt mondja ki, hogy nincs mért
 * javaslat - a felület mindkét esetben megjeleníthető szöveget kap, tippelt
 * szám nélkül.
 */
export interface ConcurrencySuggestion {
  readonly suggestedLimit: number | undefined;
  readonly note: string;
}
