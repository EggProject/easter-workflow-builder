import { describe, expect, it } from 'vitest';
import { toText } from './to-text.ts';

// A `unicorn/no-null` miatt a JSON `null` értéket elemzés adja.
const jsonNull: unknown = JSON.parse('null');

class Pelda {
  readonly mezo = 1;
}

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

  it('a tömb és a sima objektum JSON szöveg, beágyazva is', () => {
    expect(toText(['a', 1, jsonNull, { k: 'v' }])).toBe('["a",1,null,{"k":"v"}]');
    expect(toText({ nev: 'Anna', tagok: ['t1'] })).toBe('{"nev":"Anna","tagok":["t1"]}');
    expect(toText([])).toBe('[]');
    expect(toText({})).toBe('{}');
  });

  it('a null prototípusú objektum is sima objektum', () => {
    const value: unknown = Object.assign(Object.create(null), { a: 1 });
    expect(toText(value)).toBe('{"a":1}');
  });

  it('minden más értékre undefined (szigorú kiírás, user döntés 2026-10-25)', () => {
    for (const value of [new Map(), new Date(0), new Pelda(), 1n, Symbol('x'), new Uint8Array([1])]) {
      expect(toText(value)).toBeUndefined();
    }
  });

  it('a nem véges szám a felső szinten is undefined', () => {
    for (const value of [NaN, Infinity, -Infinity]) {
      expect(toText(value)).toBeUndefined();
    }
  });

  it('a beágyazott nem JSON érték is undefined, kivétel nélkül (user döntés 2026-10-25: mélyen szigorú)', () => {
    for (const value of [new Map(), new Date(0), new Pelda(), 1n, Symbol('x'), new Uint8Array([1]), NaN]) {
      expect(toText([value])).toBeUndefined();
      expect(toText({ a: [{ b: value }] })).toBeUndefined();
    }
  });

  it('a körkörös sima objektum undefined, a mélyen beágyazott tiszta JSON átmegy', () => {
    const circular: Record<string, unknown> = {};
    circular['self'] = circular;
    expect(toText(circular)).toBeUndefined();
    expect(toText({ a: [{ b: [{ c: 'x' }, 2] }] })).toBe('{"a":[{"b":[{"c":"x"},2]}]}');
  });

  it('a kiírt szöveg a vizsgált adat, akkor is, ha egy Proxy get csapdája mást adna (review J1)', () => {
    const lyingObject: unknown = new Proxy(
      { a: 1 },
      {
        get(target, key) {
          if (key === 'toJSON') {
            return () => 'HAMIS';
          }
          const fallback: unknown = Reflect.get(target, key);
          return fallback;
        },
      },
    );
    const lyingArray: unknown = new Proxy([1, 2], {
      get(target, key) {
        if (key === '0') {
          return 'HAMIS';
        }
        const fallback: unknown = Reflect.get(target, key);
        return fallback;
      },
    });
    expect(toText(lyingObject)).toBe('{"a":1}');
    expect(toText(lyingArray)).toBe('[1,2]');
    expect(toText({ k: lyingArray })).toBe('{"k":[1,2]}');
  });
});
