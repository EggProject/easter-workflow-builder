import { describe, expect, it } from 'vitest';
import { canSerializeOutput } from './can-serialize-output.ts';

describe('canSerializeOutput', () => {
  it('JSON adatra igaz', () => {
    expect(canSerializeOutput([1, 'a', { b: [true, false] }])).toBe(true);
  });

  it('a szerializáláskor kivételt dobó értékre hamis', () => {
    const tooLarge = {
      toJSON: (): never => {
        throw new RangeError('Invalid string length');
      },
    };
    expect(canSerializeOutput([tooLarge])).toBe(false);
  });
});
