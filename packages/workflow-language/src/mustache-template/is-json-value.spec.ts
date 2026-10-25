import { describe, expect, it } from 'vitest';
import { isJsonValue } from './is-json-value.ts';

// A `unicorn/no-null` miatt a JSON `null` értéket elemzés adja.
const jsonNull: unknown = JSON.parse('null');

class Pelda {
  readonly mezo = 1;
}

/**
Nem JSON értékek, minden alakban (SPEC-010 6.5, user döntés 2026-10-25).
*/
const NON_JSON_VALUES: readonly (readonly [string, unknown])[] = [
  ['Map', new Map()],
  ['Date', new Date(0)],
  ['osztálypéldány', new Pelda()],
  ['BigInt', 1n],
  ['Symbol', Symbol('x')],
  ['függvény', () => 1],
  ['Uint8Array', new Uint8Array([1])],
  ['undefined', undefined],
  ['NaN', NaN],
  ['pozitív végtelen', Infinity],
  ['negatív végtelen', -Infinity],
];

describe('isJsonValue', () => {
  it('a szöveg, a véges szám, a logikai érték és a null JSON érték', () => {
    for (const value of ['', 'a<b>', 0, -0.5, 42, true, false, jsonNull]) {
      expect(isJsonValue(value)).toBe(true);
    }
  });

  it('a tömb és a sima objektum JSON érték, a null prototípusú is', () => {
    expect(isJsonValue([])).toBe(true);
    expect(isJsonValue({})).toBe(true);
    const nullPrototype: unknown = Object.assign(Object.create(null), { a: 1 });
    expect(isJsonValue(nullPrototype)).toBe(true);
  });

  it('a mélyen beágyazott tiszta JSON átmegy', () => {
    expect(isJsonValue({ a: [1, { b: ['x', jsonNull, [true, { c: { d: [0.5] } }]] }], e: {} })).toBe(true);
  });

  it.each(NON_JSON_VALUES)('a(z) %s nem JSON érték', (_name, value) => {
    expect(isJsonValue(value)).toBe(false);
  });

  it.each(NON_JSON_VALUES)(
    'a beágyazott %s a tömbben, az objektumban és több szint mélyen sem JSON',
    (_name, value) => {
      expect(isJsonValue([value])).toBe(false);
      expect(isJsonValue({ k: value })).toBe(false);
      expect(isJsonValue({ a: [1, { b: [[value]] }] })).toBe(false);
    },
  );

  it('a getteres tulajdonság nem JSON adat, és a getter nem fut le', () => {
    let getterCalls = 0;
    const value = {
      get titok() {
        getterCalls += 1;
        return 'x';
      },
    };
    expect(isJsonValue(value)).toBe(false);
    expect(getterCalls).toBe(0);
  });

  it('a tömb lyuka nem JSON érték', () => {
    const sparse: unknown[] = [1];
    sparse[2] = 3;
    expect(isJsonValue(sparse)).toBe(false);
  });

  it('a körkörös sima objektum és tömb nem JSON érték, közvetve sem', () => {
    const circular: Record<string, unknown> = {};
    circular['self'] = circular;
    const loop: unknown[] = [];
    loop.push({ back: loop });
    const indirect: Record<string, unknown> = { child: { grand: {} } };
    const child = indirect['child'];
    if (typeof child === 'object' && child !== null) {
      Object.assign(child, { up: indirect });
    }
    expect(isJsonValue(circular)).toBe(false);
    expect(isJsonValue(loop)).toBe(false);
    expect(isJsonValue(indirect)).toBe(false);
  });

  it('ugyanaz a konténer két testvér ágon nem körkörös', () => {
    const shared = { k: [1] };
    expect(isJsonValue({ a: shared, b: shared, c: [shared, shared] })).toBe(true);
  });
});
