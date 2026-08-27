import { describe, it, expect } from 'vitest';
import { isFunctionReturnAny } from './is-function-return-any';
import { MAGIC_NUMBER_123 } from '../test-constants/test-constants';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- a tesztelt guard kifejezetten az `any` visszatérésű függvényeket vizsgálja
function returnsAnything(): any {
  return 'string';
}

function regularFunction(): string {
  return 'test';
}

const arrowFunction = (): string => 'test';

// eslint-disable-next-line @typescript-eslint/require-await
const asyncFunction = async (): Promise<string> => 'test';

const typeGuardValue = (): { data: string } => ({ data: 'test' });

describe('isFunctionReturnAny', () => {
  it('should return true for function returning any type', () => {
    expect(isFunctionReturnAny(returnsAnything)).toBe(true);
  });

  it('should return true for regular function', () => {
    expect(isFunctionReturnAny(regularFunction)).toBe(true);
  });

  it('should return true for arrow function', () => {
    expect(isFunctionReturnAny(arrowFunction)).toBe(true);
  });

  it('should return true for async function', () => {
    expect(isFunctionReturnAny(asyncFunction)).toBe(true);
  });

  it('should return true for class constructor', () => {
    // eslint-disable-next-line @typescript-eslint/no-extraneous-class -- konstruktor teszt fixture, szándékosan üres
    class MyClass {}
    expect(isFunctionReturnAny(MyClass)).toBe(true);
  });

  it('should return false for strings', () => {
    expect(isFunctionReturnAny('string')).toBe(false);
  });

  it('should return false for numbers', () => {
    expect(isFunctionReturnAny(MAGIC_NUMBER_123)).toBe(false);
  });

  it('should return false for objects', () => {
    expect(isFunctionReturnAny({})).toBe(false);
  });

  it('should return false for arrays', () => {
    expect(isFunctionReturnAny([])).toBe(false);
  });

  it('should return false for null and undefined', () => {
    expect(isFunctionReturnAny(undefined)).toBe(false);
    // A `null` literált a lint tiltja, a guardnak viszont pont a null értéket
    // kell kizárnia, ezért így állítjuk elő (lásd is-record.test.ts).
    const nullValue: unknown = JSON.parse('null');
    expect(isFunctionReturnAny(nullValue)).toBe(false);
  });

  it('should work as type guard with any return type', () => {
    expect(isFunctionReturnAny(typeGuardValue)).toBe(true);
    const result = typeGuardValue();
    expect(result).toBeDefined();
  });
});
