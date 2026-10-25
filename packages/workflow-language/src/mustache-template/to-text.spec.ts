import { describe, expect, it } from 'vitest';
import { toText } from './to-text.ts';

// A `unicorn/no-null` miatt a JSON `null` értéket elemzés adja.
const jsonNull: unknown = JSON.parse('null');

describe('toText', () => {
  it('a szöveg változatlan', () => {
    expect(toText('a<b>&')).toBe('a<b>&');
  });

  it('a szám, a logikai érték és a null String(value) alakot kap', () => {
    expect(toText(42)).toBe('42');
    expect(toText(0.5)).toBe('0.5');
    expect(toText(true)).toBe('true');
    expect(toText(false)).toBe('false');
    expect(toText(jsonNull)).toBe('null');
  });

  it('a tömb és az objektum JSON szöveg, beágyazva is', () => {
    expect(toText(['a', 1, jsonNull, { k: 'v' }])).toBe('["a",1,null,{"k":"v"}]');
    expect(toText({ nev: 'Anna', tagok: ['t1'] })).toBe('{"nev":"Anna","tagok":["t1"]}');
    expect(toText([])).toBe('[]');
    expect(toText({})).toBe('{}');
  });
});
