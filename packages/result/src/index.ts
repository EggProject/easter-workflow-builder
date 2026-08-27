// Barrel: csak újraexport, a csomag publikus felülete a kétállapotú eredmény típus és a rá
// szűkítő typeguard.

export type { Outcome } from './outcome/outcome.ts';
export { isOkOutcome } from './outcome/is-ok-outcome.ts';
