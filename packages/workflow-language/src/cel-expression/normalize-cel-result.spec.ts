import { describe, expect, it } from 'vitest';
import { normalizeCelResult } from './normalize-cel-result.ts';

// A `unicorn/no-null` miatt a JSON `null` értéket elemzés adja.
const jsonNull: unknown = JSON.parse('null');

class Pelda {
  readonly mezo = 1;
}

const NOT_FINITE = {
  kind: 'error',
  message: 'a kifejezés eredményében nem véges szám áll, ami JSON-ban nem ábrázolható',
};
const NOT_SAFE = { kind: 'error', message: 'a kifejezés eredményében a biztonságos tartományon kívüli egész szám áll' };
const NOT_JSON = { kind: 'error', message: 'a kifejezés eredményében nem JSON érték áll' };

describe('normalizeCelResult (SPEC-010 7.4)', () => {
  it('a szöveg, a logikai érték és a null változatlan', () => {
    for (const value of ['szöveg', '', true, false, jsonNull]) {
      expect(normalizeCelResult(value)).toStrictEqual({ kind: 'ok', value });
    }
  });

  it('a véges szám változatlan', () => {
    for (const value of [0, -1.5, 4, Number.MAX_VALUE]) {
      expect(normalizeCelResult(value)).toStrictEqual({ kind: 'ok', value });
    }
  });

  it('a NaN és a végtelen hiba', () => {
    for (const value of [NaN, Infinity, -Infinity]) {
      expect(normalizeCelResult(value)).toStrictEqual(NOT_FINITE);
    }
  });

  it('a biztonságos BigInt szám, a tartomány két határán is', () => {
    expect(normalizeCelResult(3n)).toStrictEqual({ kind: 'ok', value: 3 });
    expect(normalizeCelResult(BigInt(Number.MAX_SAFE_INTEGER))).toStrictEqual({
      kind: 'ok',
      value: Number.MAX_SAFE_INTEGER,
    });
    expect(normalizeCelResult(BigInt(Number.MIN_SAFE_INTEGER))).toStrictEqual({
      kind: 'ok',
      value: Number.MIN_SAFE_INTEGER,
    });
  });

  it('a biztonságos tartományon kívüli BigInt hiba, mindkét irányban', () => {
    expect(normalizeCelResult(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toStrictEqual(NOT_SAFE);
    expect(normalizeCelResult(BigInt(Number.MIN_SAFE_INTEGER) - 1n)).toStrictEqual(NOT_SAFE);
  });

  it('a tömb és a sima objektum rekurzívan normalizált, új értékként', () => {
    const input = [1n, { a: 2n, b: ['x', jsonNull] }];
    const outcome = normalizeCelResult(input);
    expect(outcome).toStrictEqual({ kind: 'ok', value: [1, { a: 2, b: ['x', jsonNull] }] });
    expect(outcome.kind === 'ok' && outcome.value).not.toBe(input);
    expect(input[0]).toBe(1n);
  });

  it('a null prototípusú objektum sima objektum', () => {
    const value: unknown = Object.assign(Object.create(null), { a: 1n });
    expect(normalizeCelResult(value)).toStrictEqual({ kind: 'ok', value: { a: 1 } });
  });

  it('a beágyazott, nem normalizálható érték az egész eredményt hibára viszi', () => {
    expect(normalizeCelResult([1, NaN])).toStrictEqual(NOT_FINITE);
    expect(normalizeCelResult({ a: { b: new Map() } })).toStrictEqual(NOT_JSON);
  });

  it('minden más érték hiba', () => {
    for (const value of [
      new Map([['a', 1]]),
      new Set([1]),
      new Date(0),
      new Uint8Array([1]),
      new Pelda(),
      undefined,
      Symbol('x'),
      () => 1,
      Promise.resolve(1),
    ]) {
      expect(normalizeCelResult(value)).toStrictEqual(NOT_JSON);
    }
  });
});
