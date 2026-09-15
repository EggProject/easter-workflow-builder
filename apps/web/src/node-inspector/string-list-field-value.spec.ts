import { describe, expect, it } from 'vitest';
import { fromStringListFieldValue, toStringListFieldValue } from './string-list-field-value.ts';

describe('stringListFieldValue', () => {
  it('a listát soronkénti szöveggé fűzi össze', () => {
    expect(toStringListFieldValue(['egy', 'kettő'])).toBe('egy\nkettő');
  });

  it('az üres listát üres sztringgé alakítja', () => {
    expect(toStringListFieldValue([])).toBe('');
  });

  it('a soronkénti szöveget listává bontja, sorok szélén trimmelve', () => {
    expect(fromStringListFieldValue('egy \n kettő\n')).toStrictEqual(['egy', 'kettő']);
  });

  it('az üres sorokat kiszűri', () => {
    expect(fromStringListFieldValue('egy\n\n  \nkettő')).toStrictEqual(['egy', 'kettő']);
  });
});
