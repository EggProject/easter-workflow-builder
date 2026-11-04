import { describe, expect, it } from 'vitest';
import type { ErrorObject } from 'ajv';
import { describeStructuredOutputMismatch } from './describe-structured-output-mismatch.ts';

const typeError: ErrorObject = {
  keyword: 'type',
  instancePath: '/answer',
  schemaPath: '#/properties/answer/type',
  params: { type: 'string' },
  message: 'must be string',
};

describe('describeStructuredOutputMismatch', () => {
  it('az első hiba útvonalát, kulcsszavát és szövegét nevezi meg', () => {
    expect(describeStructuredOutputMismatch([typeError])).toBe(
      'A kimenet nem illeszkedik a strukturált kimenet sémájára: a(z) "/answer" útvonalon a(z) "type" kulcsszó nem teljesül (must be string)',
    );
  });

  it('a gyökér útvonalat névvel írja ki', () => {
    expect(describeStructuredOutputMismatch([{ ...typeError, instancePath: '', keyword: 'required' }])).toContain(
      'a(z) "gyökér" útvonalon a(z) "required" kulcsszó',
    );
  });

  it('szöveg nélküli hibánál ezt mondja ki', () => {
    const withoutMessage: ErrorObject = {
      keyword: typeError.keyword,
      instancePath: typeError.instancePath,
      schemaPath: typeError.schemaPath,
      params: typeError.params,
    };

    expect(describeStructuredOutputMismatch([withoutMessage])).toContain('(nincs részletezés)');
  });

  // eslint-disable-next-line unicorn/no-null -- az Ajv `errors` mezőjének típusa a `null` értéket is tartalmazza
  it.each([[null], [undefined], [[]]])('hiba nélküli eltérésnél útvonal nélkül ír: %j', (errors) => {
    expect(describeStructuredOutputMismatch(errors)).toBe('A kimenet nem illeszkedik a strukturált kimenet sémájára');
  });
});
