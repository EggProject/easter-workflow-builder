import { describe, expect, it } from 'vitest';
import { isNonEmptyString } from './is-non-empty-string.ts';

describe('isNonEmptyString', () => {
  it('igazat ad nem üres stringre', () => {
    expect(isNonEmptyString('a')).toBe(true);
  });

  it('hamisat ad üres stringre', () => {
    expect(isNonEmptyString('')).toBe(false);
  });

  it('hamisat ad nem string értékre', () => {
    expect(isNonEmptyString(42)).toBe(false);
  });

  it('szűkíti a típust, tehát a string műveletek elérhetővé válnak', () => {
    const value: unknown = 'szoveg';
    if (!isNonEmptyString(value)) {
      throw new Error('nem üres stringre igazat kellene adnia');
    }
    expect(value).toHaveLength(6);
  });
});
