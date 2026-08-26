import { describe, expect, it } from 'vitest';
import type { Fact } from './fact.ts';
import { isKnown } from './is-known.ts';

// A két ág egy-egy minimális, de érvényes példánya. A `known` ág bizonyíték
// nélkül nem fordulna le, ezt az `EvidenceList` nem üres tuple alakja adja.
const knownFact: Fact<number> = {
  state: 'known',
  value: 42,
  evidence: [{ kind: 'measurement', id: 'M-01' }],
};

const unknownFact: Fact<number> = {
  state: 'unknown',
  reason: 'A mérés még nem futott le.',
  blockedBy: ['M-99'],
};

describe('isKnown', () => {
  it('igazat ad a known ágra', () => {
    expect(isKnown(knownFact)).toBe(true);
  });

  it('hamisat ad az unknown ágra', () => {
    expect(isKnown(unknownFact)).toBe(false);
  });

  it('szűkíti a típust, tehát a value és az evidence olvashatóvá válik', () => {
    // A `value` mező a szűkítés nélkül nem is létezik a `Fact` unión, tehát
    // ez a blokk egyben fordítási idejű állítás is, nem csak futásidejű.
    if (!isKnown(knownFact)) {
      throw new Error('a known ágnak igazat kellene adnia');
    }
    expect(knownFact.value).toBe(42);
    expect(knownFact.evidence).toHaveLength(1);
  });
});
