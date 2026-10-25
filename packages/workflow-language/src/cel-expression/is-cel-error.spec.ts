import { Environment, EvaluationError, ParseError, TypeError as CelTypeError } from '@marcbachmann/cel-js';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { isCelError } from './is-cel-error.ts';

function parseErrorOf(message: string): unknown {
  return new ParseError(message);
}

describe('isCelError', () => {
  it('a könyvtár három hibaosztályát felismeri', () => {
    expect(isCelError(new ParseError('x'))).toBe(true);
    expect(isCelError(new CelTypeError('x'))).toBe(true);
    expect(isCelError(new EvaluationError('x'))).toBe(true);
  });

  it('a valódi parse kivételt felismeri', () => {
    let thrown: unknown;
    try {
      new Environment().parse('1 +');
    } catch (error) {
      thrown = error;
    }
    expect(isCelError(thrown)).toBe(true);
  });

  it('a beépített hibát és a nem hibát elutasítja', () => {
    expect(isCelError(new TypeError('x'))).toBe(false);
    expect(isCelError(new Error('x'))).toBe(false);
    expect(isCelError({ code: 'unexpected_token', range: { start: 0, end: 0 } })).toBe(false);
    expect(isCelError(undefined)).toBe(false);
  });

  it('a három osztály uniójára szűkít', () => {
    // Függvényhíváson át jön az érték, hogy a linter ne lássa mindig igaznak a feltételt.
    const value: unknown = parseErrorOf('x');
    if (isCelError(value)) {
      expectTypeOf(value).toEqualTypeOf<ParseError | CelTypeError | EvaluationError>();
      expect(value.code).toBe('parse_error');
    }
  });
});
