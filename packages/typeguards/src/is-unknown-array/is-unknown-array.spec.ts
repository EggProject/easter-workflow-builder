import { describe, expect, expectTypeOf, it } from 'vitest';
import { isUnknownArray } from './is-unknown-array.ts';

describe('isUnknownArray', () => {
  it('igazat ad tömbre, és readonly unknown[] típusra szűkít', () => {
    const value: unknown = [1, 'a', undefined];
    expect(isUnknownArray(value)).toBe(true);
    expect(isUnknownArray([])).toBe(true);
    if (isUnknownArray(value)) {
      expectTypeOf(value).toEqualTypeOf<readonly unknown[]>();
    }
  });

  it('hamisat ad nem tömb bemenetre', () => {
    expect(isUnknownArray({ 0: 'a', length: 1 })).toBe(false);
    expect(isUnknownArray('a')).toBe(false);
    expect(isUnknownArray(undefined)).toBe(false);
  });
});
