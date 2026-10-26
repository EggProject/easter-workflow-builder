import { describe, expect, it } from 'vitest';
import { outputStorabilityOf } from './output-storability.ts';
import { MAX_STORED_OUTPUT_LENGTH } from './max-stored-output-length.ts';

/**
 * A `[` + `"` + szöveg + `"` + `]` alak JSON hossza a szöveg hossza plusz négy.
 */
const FRAME_LENGTH = 4;

describe('outputStorabilityOf', () => {
  it('JSON adatra storable', () => {
    expect(outputStorabilityOf([1, 'a', { b: [true, false] }])).toBe('storable');
  });

  it('a pontosan a korláttal egyenlő JSON hosszra storable', () => {
    const item = 'a'.repeat(MAX_STORED_OUTPUT_LENGTH - FRAME_LENGTH);
    expect(JSON.stringify([item])).toHaveLength(MAX_STORED_OUTPUT_LENGTH);
    expect(outputStorabilityOf([item])).toBe('storable');
  });

  it('a korlátnál egy karakterrel hosszabb JSON hosszra too_large', () => {
    const item = 'a'.repeat(MAX_STORED_OUTPUT_LENGTH - FRAME_LENGTH + 1);
    expect(JSON.stringify([item])).toHaveLength(MAX_STORED_OUTPUT_LENGTH + 1);
    expect(outputStorabilityOf([item])).toBe('too_large');
  });

  it('az undefined kimenetre storable, mert a db azt nem írja', () => {
    expect(outputStorabilityOf(undefined)).toBe('storable');
  });

  it('nem lista kimenetre is a JSON hosszat méri', () => {
    expect(outputStorabilityOf('a'.repeat(MAX_STORED_OUTPUT_LENGTH - 2))).toBe('storable');
    expect(outputStorabilityOf('a'.repeat(MAX_STORED_OUTPUT_LENGTH - 1))).toBe('too_large');
  });

  it('REGRESSZIÓ: a szerializáláskor kivételt dobó értékre not_serializable, nem too_large (PLAN-010 T-010-21 A-8)', () => {
    const tooLarge = {
      toJSON: (): never => {
        throw new RangeError('Invalid string length');
      },
    };
    expect(outputStorabilityOf([tooLarge])).toBe('not_serializable');
  });
});
