import { describe, expect, it } from 'vitest';
import type { Fact } from '@easter-workflow-builder/provider-capability';
import { resolveConcurrencySuggestion } from './resolve-concurrency-suggestion.ts';

function knownFact<TValue>(value: TValue): Fact<TValue> {
  return { state: 'known', value, evidence: [{ kind: 'measurement', id: 'M-01' }] };
}

function unknownFact<TValue>(): Fact<TValue> {
  return { state: 'unknown', reason: 'A mérés még nem futott le.', blockedBy: ['M-99'] };
}

describe('resolveConcurrencySuggestion', () => {
  it('known: a mért értéket adja javaslatként', () => {
    // A szám a szintetikus leíró tetszőleges bemenete, nem szállított
    // alapérték: a motor magától sosem választ párhuzamossági számot (F-22).
    expect(resolveConcurrencySuggestion(knownFact(7))).toBe(7);
  });

  it('unknown: nincs javaslat', () => {
    expect(resolveConcurrencySuggestion(unknownFact<number>())).toBeUndefined();
  });
});
