import type { Fact } from './fact.ts';

/**
Typeguard az ismeretlen ágra, hogy a UI kiírhassa az indoklást és a blokkoló méréseket.
*/
export function isUnknown<TValue>(fact: Fact<TValue>): fact is Extract<Fact<TValue>, { readonly state: 'unknown' }> {
  return fact.state === 'unknown';
}
