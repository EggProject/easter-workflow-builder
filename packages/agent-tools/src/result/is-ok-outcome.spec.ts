import { describe, expect, it } from 'vitest';
import { isOkOutcome } from './is-ok-outcome.ts';
import type { Outcome } from './outcome.ts';

const okOutcome: Outcome<number> = { kind: 'ok', value: 7 };
const errorOutcome: Outcome<number> = { kind: 'error', message: 'baj' };

describe('isOkOutcome', () => {
  it('igazat ad a sikeres ágra', () => {
    expect(isOkOutcome(okOutcome)).toBe(true);
  });

  it('hamisat ad a hibaágra', () => {
    expect(isOkOutcome(errorOutcome)).toBe(false);
  });

  it('szűkíti a típust, tehát a value olvashatóvá válik', () => {
    if (!isOkOutcome(okOutcome)) {
      throw new Error('a sikeres ágnak igazat kellene adnia');
    }
    expect(okOutcome.value).toBe(7);
  });
});
