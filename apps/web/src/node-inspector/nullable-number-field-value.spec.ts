import { describe, expect, it } from 'vitest';
import { fromNumberFieldValue, toNumberFieldValue } from './nullable-number-field-value.ts';

describe('nullableNumberFieldValue', () => {
  it('a `null` értéket üres sztringgé alakítja a mezőnek', () => {
    // eslint-disable-next-line unicorn/no-null -- a teszt a nullázható bemenetet vizsgálja.
    expect(toNumberFieldValue(null)).toBe('');
  });

  it('egy tényleges számot szöveggé alakít a mezőnek', () => {
    expect(toNumberFieldValue(5)).toBe('5');
  });

  it('az üres mezőértéket `null`-ra képezi vissza', () => {
    expect(fromNumberFieldValue('')).toBeNull();
  });

  it('egy érvényes szám szöveget számmá alakít vissza', () => {
    expect(fromNumberFieldValue('42')).toBe(42);
  });

  it('egy érvénytelen szám szöveget NaN értékké alakít, hibajelzésre bízva', () => {
    expect(fromNumberFieldValue('nem szám')).toBeNaN();
  });
});
