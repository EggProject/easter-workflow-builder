import { describe, expect, it } from 'vitest';
import { fromNumberListFieldValue, toNumberListFieldValue } from './number-list-field-value.ts';

describe('numberListFieldValue', () => {
  it('a listát soronkénti szöveggé fűzi össze', () => {
    expect(toNumberListFieldValue([100, 200])).toBe('100\n200');
  });

  it('a soronkénti szöveget szám listává bontja', () => {
    expect(fromNumberListFieldValue('100\n200\n')).toStrictEqual([100, 200]);
  });

  it('az üres sorokat kiszűri', () => {
    expect(fromNumberListFieldValue('100\n\n200')).toStrictEqual([100, 200]);
  });
});
