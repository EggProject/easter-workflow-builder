import { describe, expect, it } from 'vitest';
import { resolveOwnDataProperty } from './resolve-own-data-property.ts';

// A `unicorn/no-null` miatt a JSON `null` értéket elemzés adja.
const jsonNull: unknown = JSON.parse('null');

describe('resolveOwnDataProperty', () => {
  const view = { input: { tema: 'abc', elemek: ['x', 'y'], semmi: jsonNull, ures: undefined } };

  it('üres útvonalon a nézet maga', () => {
    expect(resolveOwnDataProperty(view, [])).toBe(view);
  });

  it('a pontozott név saját adat tulajdonságon át oldódik fel', () => {
    expect(resolveOwnDataProperty(view, ['input', 'tema'])).toBe('abc');
    expect(resolveOwnDataProperty(view, ['input', 'elemek', '1'])).toBe('y');
  });

  it('a tömb length mezője saját adat tulajdonság (O-10)', () => {
    expect(resolveOwnDataProperty(view, ['input', 'elemek', 'length'])).toBe(2);
  });

  it('a null érték találat', () => {
    expect(resolveOwnDataProperty(view, ['input', 'semmi'])).toBeNull();
  });

  it('a primitív érték beépített tulajdonsága nem találat (O-10)', () => {
    expect(resolveOwnDataProperty(view, ['input', 'tema', 'length'])).toBeUndefined();
  });

  it('null konténeren nincs találat', () => {
    expect(resolveOwnDataProperty(view, ['input', 'semmi', 'x'])).toBeUndefined();
  });

  it('a prototípus lánc neve nem találat', () => {
    expect(resolveOwnDataProperty(view, ['constructor'])).toBeUndefined();
    expect(resolveOwnDataProperty(view, ['input', 'elemek', 'map'])).toBeUndefined();
  });

  it('a jelen lévő, de undefined értékű kulcs nem találat', () => {
    expect(resolveOwnDataProperty(view, ['input', 'ures'])).toBeUndefined();
  });

  it('a függvény érték nem találat, és nem hívódik meg', () => {
    let calls = 0;
    const withFunction = {
      fn: () => {
        calls += 1;
        return 'x';
      },
    };
    expect(resolveOwnDataProperty(withFunction, ['fn'])).toBeUndefined();
    expect(resolveOwnDataProperty(withFunction, ['fn', 'name'])).toBeUndefined();
    expect(calls).toBe(0);
  });

  it('a getter nem adat tulajdonság: nem találat, és nem fut le', () => {
    let calls = 0;
    const withGetter = {
      get titok() {
        calls += 1;
        return 'x';
      },
    };
    expect(resolveOwnDataProperty(withGetter, ['titok'])).toBeUndefined();
    expect(calls).toBe(0);
  });
});
