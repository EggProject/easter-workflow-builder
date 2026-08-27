import type { Outcome } from './outcome.ts';

/**
 * Typeguard: enélkül a `value` mező nem olvasható, mert a hibaágon nem létezik.
 */
export function isOkOutcome<TValue>(
  outcome: Outcome<TValue>,
): outcome is Extract<Outcome<TValue>, { readonly kind: 'ok' }> {
  return outcome.kind === 'ok';
}
