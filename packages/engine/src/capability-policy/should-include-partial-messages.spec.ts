import { describe, expect, it } from 'vitest';
import type { Fact } from '@easter-workflow-builder/provider-capability';
import { shouldIncludePartialMessages } from './should-include-partial-messages.ts';

function knownFact<TValue>(value: TValue): Fact<TValue> {
  return { state: 'known', value, evidence: [{ kind: 'measurement', id: 'M-01' }] };
}

function unknownFact<TValue>(): Fact<TValue> {
  return { state: 'unknown', reason: 'A mérés még nem futott le.', blockedBy: ['M-99'] };
}

describe('shouldIncludePartialMessages', () => {
  it('known igaz: includePartialMessages true', () => {
    expect(shouldIncludePartialMessages(knownFact(true))).toBe(true);
  });

  it('known hamis: includePartialMessages false', () => {
    expect(shouldIncludePartialMessages(knownFact(false))).toBe(false);
  });

  it('unknown: includePartialMessages false, konzervatív visszaesésként', () => {
    expect(shouldIncludePartialMessages(unknownFact<boolean>())).toBe(false);
  });
});
