import type { Fact } from './fact.ts';

/**
 * Typeguard: a fogyasztó oldal enélkül nem olvashat `value` mezőt, mert az
 * `unknown` ágon nem létezik.
 */
export function isKnownFact<TValue>(fact: Fact<TValue>): fact is Extract<Fact<TValue>, { readonly state: 'known' }> {
  return fact.state === 'known';
}
