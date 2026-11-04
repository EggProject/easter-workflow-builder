import type { HostCallOutcome } from './host-call-outcome.ts';

/**
 * A `resolvePathInRoot` eredménye: a gyökérhez feloldott, lexikálisan a gyökér
 * alatti abszolút útvonal a szkript eredeti, szöveg útvonalával, vagy a sandbox
 * felé menő elutasítás.
 *
 * Típus-only fájl, nincs hozzá `.spec.ts`.
 */
export type PathInRoot =
  | Extract<HostCallOutcome, { kind: 'rejected' }>
  | { readonly kind: 'path'; readonly path: string; readonly requested: string };
