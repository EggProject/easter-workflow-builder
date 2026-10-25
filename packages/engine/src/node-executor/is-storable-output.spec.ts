import { describe, expect, it } from 'vitest';
import { isStorableOutput } from './is-storable-output.ts';
import { MAX_STORED_OUTPUT_LENGTH } from './max-stored-output-length.ts';

/**
 * A `[` + `"` + szöveg + `"` + `]` alak JSON hossza a szöveg hossza plusz négy.
 */
const FRAME_LENGTH = 4;

describe('isStorableOutput', () => {
  it('JSON adatra igaz', () => {
    expect(isStorableOutput([1, 'a', { b: [true, false] }])).toBe(true);
  });

  it('a pontosan a korláttal egyenlő JSON hosszra igaz', () => {
    const item = 'a'.repeat(MAX_STORED_OUTPUT_LENGTH - FRAME_LENGTH);
    expect(JSON.stringify([item])).toHaveLength(MAX_STORED_OUTPUT_LENGTH);
    expect(isStorableOutput([item])).toBe(true);
  });

  it('a korlátnál egy karakterrel hosszabb JSON hosszra hamis', () => {
    const item = 'a'.repeat(MAX_STORED_OUTPUT_LENGTH - FRAME_LENGTH + 1);
    expect(JSON.stringify([item])).toHaveLength(MAX_STORED_OUTPUT_LENGTH + 1);
    expect(isStorableOutput([item])).toBe(false);
  });

  it('az undefined kimenetre igaz, mert a db azt nem írja', () => {
    expect(isStorableOutput(undefined)).toBe(true);
  });

  it('nem lista kimenetre is a JSON hosszat méri', () => {
    expect(isStorableOutput('a'.repeat(MAX_STORED_OUTPUT_LENGTH - 2))).toBe(true);
    expect(isStorableOutput('a'.repeat(MAX_STORED_OUTPUT_LENGTH - 1))).toBe(false);
  });

  it('a szerializáláskor kivételt dobó értékre hamis', () => {
    const tooLarge = {
      toJSON: (): never => {
        throw new RangeError('Invalid string length');
      },
    };
    expect(isStorableOutput([tooLarge])).toBe(false);
  });
});
