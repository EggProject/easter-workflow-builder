/**
 * A `waitForSettlement` eredménye: a várt ígéret értéke, a gazda oldali
 * határidő vagy a kérés külső megszakítása.
 *
 * Típus-only fájl, nincs hozzá `.spec.ts`.
 */
export type Settlement<TValue> =
  { readonly kind: 'settled'; readonly value: TValue } | { readonly kind: 'timed_out' } | { readonly kind: 'aborted' };
