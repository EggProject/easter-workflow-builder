import { describe, expect, it } from 'vitest';
import { fromTextFieldValue, toTextFieldValue } from './nullable-text-field-value.ts';

describe('nullableTextFieldValue', () => {
  it('a `null` értéket üres sztringgé alakítja a mezőnek', () => {
    // eslint-disable-next-line unicorn/no-null -- a teszt a nullázható bemenetet vizsgálja.
    expect(toTextFieldValue(null)).toBe('');
  });

  it('egy tényleges szöveget változatlanul ad vissza a mezőnek', () => {
    expect(toTextFieldValue('érték')).toBe('érték');
  });

  it('az üres mezőértéket `null`-ra képezi vissza', () => {
    expect(fromTextFieldValue('')).toBeNull();
  });

  it('a csak szóközből álló mezőértéket is `null`-ra képezi vissza', () => {
    expect(fromTextFieldValue(' '.repeat(3))).toBeNull();
  });

  it('egy tényleges mezőértéket változatlanul ad vissza', () => {
    expect(fromTextFieldValue('érték')).toBe('érték');
  });
});
