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

  it('a táblában nem álló kód a közös mondatot kapja a kóddal, a könyvtár szövege nélkül (user döntés 2026-10-25)', () => {
    expect(describeCelError(new ParseError({ code: 'ismeretlen_kod', message: 'TITKOS' }))).toBe(
      'a kifejezés nem dolgozható fel (kód: ismeretlen_kod)',
    );
    expect(
      describeCelError(new EvaluationError({ code: 'ismeretlen_kod', message: 'TITKOS', range: { start: 2, end: 3 } })),
    ).toBe('a kifejezés nem dolgozható fel (kód: ismeretlen_kod) (pozíció: 2)');
    expect(describeCelError(new ParseError({ code: 'constructor', message: 'TITKOS' }))).toBe(
      'a kifejezés nem dolgozható fel (kód: constructor)',
    );
    expect(describeCelError(new EvaluationError('TITKOS'))).toBe(
      'a kifejezés nem dolgozható fel (kód: evaluation_error)',
    );
  });

  it('a futásidejű kódok saját mondatot kapnak', () => {
    const range = { start: 6, end: 13 };
    expect(describeCelError(new EvaluationError({ code: 'no_such_key', message: 'No such key: TITKOS', range }))).toBe(
      'a hivatkozott kulcs nem létezik (pozíció: 6)',
    );
    expect(
      describeCelError(new EvaluationError({ code: 'unsupported_type', message: 'Unsupported type: object' })),
    ).toBe('az adat egy értékének típusa a kifejezésben nem kezelhető (például saját constructor kulcsú objektum)');
  });

  it('a nem CEL kivétel kód nélkül, a közös mondatot kapja', () => {
    expect(describeCelError(new Error('TITKOS'))).toBe('a kifejezés nem dolgozható fel');
    expect(describeCelError(undefined)).toBe('a kifejezés nem dolgozható fel');
  });
});
