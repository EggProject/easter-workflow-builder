import { describe, it, expect } from 'vitest';
import { isFunction } from './is-function.ts';
import { MAGIC_NUMBER_123, POSITIVE_INT_ZERO } from '../test-constants/test-constants.ts';

function regularFunction(): string {
  return 'test';
}

const arrowFunction = (): string => 'test';

const anonymousFunction = function (): string {
  return 'test';
};

// eslint-disable-next-line @typescript-eslint/require-await
const asyncFunction = async (): Promise<string> => 'test';

// A union típus kell ahhoz, hogy az `isFunction` Extract<T, ...> alapú
// szűkítése valódi híható típust adjon: `unknown`-ból kiindulva a szűkítés
// mindig `never`-t adna (lásd `tsc --noEmit`: "Type 'never' has no call
// signatures"), `as` kényszerítés nélkül pedig az nem hívható.
const typeGuardValue: string | (() => string) = (): string => 'test';

describe('isFunction', () => {
  it('should return true for regular function', () => {
    expect(isFunction(regularFunction)).toBe(true);
  });

  it('should return true for arrow function', () => {
    expect(isFunction(arrowFunction)).toBe(true);
  });

  it('should return true for anonymous function', () => {
    expect(isFunction(anonymousFunction)).toBe(true);
  });

  it('should return true for async function', () => {
    expect(isFunction(asyncFunction)).toBe(true);
  });

  it('should return true for class constructor', () => {
    // eslint-disable-next-line @typescript-eslint/no-extraneous-class -- konstruktor teszt fixture, szándékosan üres
    class MyClass {}
    expect(isFunction(MyClass)).toBe(true);
  });

  it('should return true for built-in constructors', () => {
    expect(isFunction(Array)).toBe(true);
    expect(isFunction(Object)).toBe(true);
    expect(isFunction(Date)).toBe(true);
    expect(isFunction(String)).toBe(true);
  });

  it('should return false for strings', () => {
    expect(isFunction('string')).toBe(false);
    expect(isFunction('function')).toBe(false);
  });

  it('should return false for numbers', () => {
    expect(isFunction(MAGIC_NUMBER_123)).toBe(false);
    expect(isFunction(POSITIVE_INT_ZERO)).toBe(false);
    expect(isFunction(NaN)).toBe(false);
  });

  it('should return false for booleans', () => {
    expect(isFunction(true)).toBe(false);
    expect(isFunction(false)).toBe(false);
  });

  it('should return false for null and undefined', () => {
    expect(isFunction(undefined)).toBe(false);
    // A `null` literált a lint tiltja, a guardnak viszont pont a null értéket
    // kell kizárnia, ezért így állítjuk elő (lásd is-record.test.ts).
    const nullValue: unknown = JSON.parse('null');
    expect(isFunction(nullValue)).toBe(false);
  });

  it('should return false for objects', () => {
    expect(isFunction({})).toBe(false);
    expect(
      isFunction({
        fn: () => {
          /*
          empty
          */
        },
      }),
    ).toBe(false);
  });

  it('should return false for arrays', () => {
    expect(isFunction([])).toBe(false);
    expect(
      isFunction([
        () => {
          /*
          empty
          */
        },
      ]),
    ).toBe(false);
  });

  it('should work as type guard', () => {
    expect(isFunction(typeGuardValue)).toBe(true);
    if (isFunction(typeGuardValue)) {
      // A guard `never`-re szűkíti az értéket (unknown -> Extract<unknown, Fn> = never),
      // a `never` viszont hívható típusmódosítás nélkül is.
      const result = typeGuardValue();
      expect(typeof result).toBe('string');
    }
  });
});
