import { describe, expect, it } from 'vitest';
import type { Fact } from './fact.ts';
import { isUnknownFact } from './is-unknown-fact.ts';

const knownFact: Fact<string> = {
  state: 'known',
  value: 'adaptive',
  evidence: [{ kind: 'doc', url: 'https://example.invalid/doc' }],
};

const unknownFact: Fact<string> = {
  state: 'unknown',
  reason: 'A providernek nincs dokumentált válasza erre a mezőre.',
  blockedBy: ['M-12', 'M-13'],
};

describe('isUnknownFact', () => {
  it('igazat ad az unknown ágra', () => {
    expect(isUnknownFact(unknownFact)).toBe(true);
  });

  it('hamisat ad a known ágra', () => {
    expect(isUnknownFact(knownFact)).toBe(false);
  });

  it('szűkíti a típust, tehát a reason és a blockedBy olvashatóvá válik', () => {
    if (!isUnknownFact(unknownFact)) {
      throw new Error('az unknown ágnak igazat kellene adnia');
    }
    expect(unknownFact.reason).not.toHaveLength(0);
    expect(unknownFact.blockedBy).toStrictEqual(['M-12', 'M-13']);
  });
});
