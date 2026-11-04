import { describe, expect, it } from 'vitest';
import { compileStructuredOutputSchema } from './compile-structured-output-schema.ts';

describe('compileStructuredOutputSchema', () => {
  it('érvényes draft-07 sémát lefordít', () => {
    const outcome = compileStructuredOutputSchema({
      // A draft-07 meta-séma azonosítója a szabvány szerint `http` sémájú URI, nem letöltési cím.
      // eslint-disable-next-line unicorn/prefer-https -- a meta-séma azonosítója szó szerint ez
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: { answer: { type: 'string' } },
      required: ['answer'],
    });

    expect(outcome.kind).toBe('ok');
  });

  it('a logikai sémát lefordítja', () => {
    expect(compileStructuredOutputSchema(true).kind).toBe('ok');
  });

  it('két azonos `$id` értékű séma egymás után is lefordul (nincs közös példány)', () => {
    const schema = { $id: 'https://example.test/answer', type: 'object' };

    expect(compileStructuredOutputSchema(schema).kind).toBe('ok');
    expect(compileStructuredOutputSchema(schema).kind).toBe('ok');
  });

  it.each([
    ['draft 2020-12', 'https://json-schema.org/draft/2020-12/schema'],
    ['draft 2019-09', 'https://json-schema.org/draft/2019-09/schema'],
    // eslint-disable-next-line unicorn/prefer-https -- a meta-séma azonosítója szó szerint ez
    ['draft-04, a régebbi változat', 'http://json-schema.org/draft-04/schema#'],
  ])('a nem draft-07 $schema (%s) érvénytelen', (_name, metaSchema) => {
    expect(compileStructuredOutputSchema({ $schema: metaSchema, type: 'object' })).toEqual({
      kind: 'error',
      message: `A strukturált kimenet sémája érvénytelen: no schema with key or ref "${metaSchema}"`,
    });
  });

  it('a meta-sémára nem illeszkedő séma érvénytelen', () => {
    const outcome = compileStructuredOutputSchema({ type: 'strin' });

    expect(outcome.kind).toBe('error');
    expect(outcome.kind === 'error' && outcome.message).toMatch(
      /^A strukturált kimenet sémája érvénytelen: schema is invalid/u,
    );
  });

  it('strict módban az ismeretlen kulcsszó érvénytelen', () => {
    expect(compileStructuredOutputSchema({ type: 'object', answerType: 'string' })).toEqual({
      kind: 'error',
      message: 'A strukturált kimenet sémája érvénytelen: strict mode: unknown keyword: "answerType"',
    });
  });

  // eslint-disable-next-line unicorn/no-null -- a JSON `null` érték a tárolt séma mezőben előfordulhat
  it.each([['szöveg'], [42], [null], [[]]])('nem objektum és nem logikai séma érvénytelen: %j', (schema) => {
    expect(compileStructuredOutputSchema(schema)).toEqual({
      kind: 'error',
      message: 'A strukturált kimenet sémája érvénytelen: a séma nem objektum és nem logikai érték',
    });
  });

  it('az aszinkron séma érvénytelen', () => {
    expect(compileStructuredOutputSchema({ $async: true, type: 'object' })).toEqual({
      kind: 'error',
      message: 'A strukturált kimenet sémája érvénytelen: az aszinkron ($async) séma nem támogatott',
    });
  });
});
