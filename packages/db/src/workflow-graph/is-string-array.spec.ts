import { describe, expect, it } from 'vitest';
import { isStringArray } from './is-string-array.ts';

describe('isStringArray', () => {
  it('igazat ad üres és csak szöveget tartalmazó tömbre', () => {
    expect(isStringArray([])).toBe(true);
    expect(isStringArray(['Bash', 'Read'])).toBe(true);
  });

  it('hamisat ad, ha egyetlen elem sem szöveg', () => {
    expect(isStringArray([1])).toBe(false);
    expect(isStringArray(['Bash', 2])).toBe(false);
    expect(isStringArray([undefined])).toBe(false);
  });

  it('hamisat ad nem tömb bemenetre', () => {
    expect(isStringArray('Bash')).toBe(false);
    expect(isStringArray({ 0: 'Bash', length: 1 })).toBe(false);
    expect(isStringArray(undefined)).toBe(false);
  });
});
