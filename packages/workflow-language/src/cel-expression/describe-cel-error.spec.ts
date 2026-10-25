import { EvaluationError, ParseError, TypeError as CelTypeError } from '@marcbachmann/cel-js';
import { describe, expect, it } from 'vitest';
import { describeCelError } from './describe-cel-error.ts';

describe('describeCelError (SPEC-010 9.5)', () => {
  it('a kód szerinti mondat plusz a range kezdete, a summary nélkül', () => {
    const error = new CelTypeError({
      code: 'unknown_variable',
      message: 'Unknown variable: titokNeve',
      range: { start: 3, end: 12 },
    });
    expect(describeCelError(error)).toBe('nem deklarált változó a kifejezésben (pozíció: 3)');
  });

  it('range nélkül csak a mondat', () => {
    expect(describeCelError(new ParseError({ code: 'limit_exceeded', message: 'Exceeded maxDepth (250)' }))).toBe(
      'a kifejezés túllépi a nyelv beépített szerkezeti korlátját',
    );
  });

  it('mindhárom hibaosztályt a kód szerint írja le', () => {
    const range = { start: 0, end: 1 };
    expect(describeCelError(new ParseError({ code: 'unexpected_token', message: 'x', range }))).toBe(
      'váratlan jel a kifejezésben (pozíció: 0)',
    );
    expect(describeCelError(new EvaluationError({ code: 'cannot_index_type', message: 'x', range }))).toBe(
      'ez az érték nem indexelhető (pozíció: 0)',
    );
  });

  it('az ismeretlen kód, a prototípus nevű kód és a nem CEL kivétel közös mondatot kap, a könyvtár szövege nélkül', () => {
    expect(describeCelError(new ParseError({ code: 'ismeretlen_kod', message: 'TITKOS' }))).toBe(
      'a kifejezés nem dolgozható fel',
    );
    expect(describeCelError(new ParseError({ code: 'constructor', message: 'TITKOS' }))).toBe(
      'a kifejezés nem dolgozható fel',
    );
    expect(describeCelError(new Error('TITKOS'))).toBe('a kifejezés nem dolgozható fel');
    expect(describeCelError(undefined)).toBe('a kifejezés nem dolgozható fel');
  });
});
