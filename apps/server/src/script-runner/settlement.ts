/**
 * A `waitForSettlement` eredménye: a várt ígéret értéke vagy a gazda oldali
 * határidő.
 *
 * Típus-only fájl, nincs hozzá `.spec.ts`.
 */
export type Settlement<TValue> = { readonly kind: 'settled'; readonly value: TValue } | { readonly kind: 'timed_out' };
