import { isRecord } from '@easter-workflow-builder/typeguards';
import { describe, expect, it } from 'vitest';
import { copyJsonValue } from './copy-json-value.ts';

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

/**
 * Az `n` szintű duplázott szerkezet: minden szinten `[x, x]`, ahol a két elem
 * ugyanaz a tömb. A hossza lineáris, a fává bontása 2^n levelű.
 */
function doubled(n: number): unknown {
  let value: unknown = 1;
  for (let depth = 0; depth < n; depth += 1) {
    value = [value, value];
  }
  return value;
}

describe('copyJsonValue', () => {
  it('a szöveg, a véges szám, a logikai érték és a null JSON érték', () => {
    for (const value of ['', 'a<b>', 0, -0.5, 42, true, false, jsonNull]) {
      expect(copyJsonValue(value)).toBe(value);
    }
  });

  it('a tömb és a sima objektum JSON érték, a null prototípusú is', () => {
    expect(copyJsonValue([])).toStrictEqual([]);
    expect(copyJsonValue({})).toStrictEqual({});
    const nullPrototype: unknown = Object.assign(Object.create(null), { a: 1 });
    expect(copyJsonValue(nullPrototype)).toStrictEqual({ a: 1 });
  });

  it('a mélyen beágyazott tiszta JSON átmegy', () => {
    const value = { a: [1, { b: ['x', jsonNull, [true, { c: { d: [0.5] } }]] }], e: {} };
    const copy = copyJsonValue(value);
    expect(copy).toStrictEqual(value);
    expect(copy).not.toBe(value);
  });

  it.each(NON_JSON_VALUES)('a(z) %s nem JSON érték', (_name, value) => {
    expect(copyJsonValue(value)).toBeUndefined();
  });

  it.each(NON_JSON_VALUES)(
    'a beágyazott %s a tömbben, az objektumban és több szint mélyen sem JSON',
    (_name, value) => {
      expect(copyJsonValue([value])).toBeUndefined();
      expect(copyJsonValue({ k: value })).toBeUndefined();
      expect(copyJsonValue({ a: [1, { b: [[value]] }] })).toBeUndefined();
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
    expect(copyJsonValue(value)).toBeUndefined();
    expect(getterCalls).toBe(0);
  });

  it('a tömb lyuka nem JSON érték', () => {
    const sparse: unknown[] = [1];
    sparse[2] = 3;
    expect(copyJsonValue(sparse)).toBeUndefined();
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
    expect(copyJsonValue(circular)).toBeUndefined();
    expect(copyJsonValue(loop)).toBeUndefined();
    expect(copyJsonValue(indirect)).toBeUndefined();
  });

  it('ugyanaz a konténer két testvér ágon nem körkörös', () => {
    const shared = { k: [1] };
    expect(copyJsonValue({ a: shared, b: shared, c: [shared, shared] })).toStrictEqual({
      a: { k: [1] },
      b: { k: [1] },
      c: [{ k: [1] }, { k: [1] }],
    });
  });

  it('a Proxy get csapdája nem jut a másolatba: a másolat a tulajdonság leíró adata (review J1)', () => {
    const lying: unknown = new Proxy(
      { a: 1, l: [2] },
      {
        get(target, key) {
          if (key === 'toJSON') {
            return () => 'HAMIS';
          }
          if (key === 'a') {
            return 999;
          }
          const fallback: unknown = Reflect.get(target, key);
          return fallback;
        },
      },
    );
    const copy = copyJsonValue(lying);
    expect(copy).toStrictEqual({ a: 1, l: [2] });
    expect(JSON.stringify(copy)).toBe('{"a":1,"l":[2]}');
  });

  it('a __proto__ saját kulcs a másolatban is saját adat kulcs, nem prototípus', () => {
    const value: unknown = JSON.parse('{"__proto__":{"x":1}}');
    const copy = copyJsonValue(value);
    expect(JSON.stringify(copy)).toBe('{"__proto__":{"x":1}}');
    expect(Object.getPrototypeOf(copy)).toBe(Object.prototype);
  });

  it('a közös hivatkozás megmarad: ugyanarra a forrásra ugyanaz a másolat (O-16)', () => {
    const shared = { k: [1] };
    const copy = copyJsonValue({ a: shared, b: shared, c: [shared, shared] });
    if (!isRecord(copy) || !Array.isArray(copy['c'])) {
      throw new TypeError('ok objektum másolatot vártunk');
    }
    const first: unknown = copy['c'][0];
    const second: unknown = copy['c'][1];
    expect(copy['a']).toBe(copy['b']);
    expect(copy['a']).toBe(first);
    expect(first).toBe(second);
    expect(first).not.toBe(shared);
  });

  it('két külön hívás nem osztozik a másolaton', () => {
    const shared = [1];
    expect(copyJsonValue(shared)).not.toBe(copyJsonValue(shared));
  });

  // Regresszió (O-16, research 10.2): a duplázott szerkezetet a másolás régen fává
  // bontotta, ami a szint számával exponenciális időt és memóriát jelentett. A teszt
  // nem időt mér: a szerkezetet állítja, hogy minden szinten a két testvér ugyanaz a
  // tömb (a fává bontás minden szinten két külön másolatot adna), és a kis n állítás a
  // régi kódon már bukik, mielőtt a nagy n másolása elindulna.
  it.each([3, 200])('a duplázott szerkezet másolása lineáris, a testvérek azonosak (n = %i)', (n) => {
    let level: unknown = copyJsonValue(doubled(n));
    for (let depth = 0; depth < n; depth += 1) {
      if (!Array.isArray(level)) {
        throw new TypeError(`a(z) ${String(depth)}. szinten listát vártunk`);
      }
      expect(level).toHaveLength(2);
      expect(level[0]).toBe(level[1]);
      level = level[0];
    }
    expect(level).toBe(1);
  });

  it('a közös hivatkozás mellett a körkörös hivatkozást is felismeri, és a hiba nem kerül a gyorsítótárba', () => {
    const loop: Record<string, unknown> = {};
    loop['self'] = loop;
    expect(copyJsonValue([loop, loop])).toBeUndefined();
    expect(copyJsonValue({ a: [loop], b: [loop] })).toBeUndefined();
  });
});
