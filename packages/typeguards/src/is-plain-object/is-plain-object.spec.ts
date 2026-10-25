import { describe, expect, expectTypeOf, it } from 'vitest';
import { isPlainObject } from './is-plain-object.ts';

class Example {
  readonly field = 1;
}

function fromJson(text: string): unknown {
  return JSON.parse(text);
}

describe('isPlainObject', () => {
  it('igazat ad Object.prototype és null prototípusú objektumra', () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject({ a: 1 })).toBe(true);
    expect(isPlainObject(fromJson('{"constructor":"saját"}'))).toBe(true);
    expect(isPlainObject(Object.create(null))).toBe(true);
  });

  it('hamisat ad tömbre, osztálypéldányra és beépített objektumra', () => {
    expect(isPlainObject([1, 2])).toBe(false);
    expect(isPlainObject(new Example())).toBe(false);
    expect(isPlainObject(new Map([['a', 1]]))).toBe(false);
    expect(isPlainObject(new Date(0))).toBe(false);
    expect(isPlainObject(new Uint8Array([1]))).toBe(false);
    expect(isPlainObject(Object.create({}))).toBe(false);
  });

  it('hamisat ad nem objektum értékre és a JSON-ból jövő null értékre', () => {
    expect(isPlainObject(fromJson('null'))).toBe(false);
    expect(isPlainObject(undefined)).toBe(false);
    expect(isPlainObject('szöveg')).toBe(false);
    expect(isPlainObject(1n)).toBe(false);
    expect(isPlainObject(() => 1)).toBe(false);
  });

  it('a kulcs-érték rekord típusra szűkít', () => {
    const value = fromJson('{"kulcs":"ertek"}');
    if (!isPlainObject(value)) {
      throw new Error('sima objektumra igazat kellene adnia');
    }
    expectTypeOf(value).toEqualTypeOf<Readonly<Record<string, unknown>>>();
    expect(value['kulcs']).toBe('ertek');
  });
});
