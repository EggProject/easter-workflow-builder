import { describe, expect, it } from 'vitest';
import { compileStructuredOutputSchema } from './compile-structured-output-schema.ts';
import type { StructuredOutputSchemaLogger } from './structured-output-schema-logger.ts';
import type { StructuredOutputValidator } from './structured-output-validator.ts';

interface WarnCall {
  readonly bindings: Readonly<Record<string, unknown>>;
  readonly message: string;
}

function failOnUnexpectedLevel(): void {
  throw new Error('a teszt nem vár info vagy error naplósort');
}

function collectingLogger(): { readonly logger: StructuredOutputSchemaLogger; readonly warnings: WarnCall[] } {
  const warnings: WarnCall[] = [];
  return {
    logger: {
      info: failOnUnexpectedLevel,
      warn: (bindings, message) => {
        warnings.push({ bindings, message });
      },
      error: failOnUnexpectedLevel,
    },
    warnings,
  };
}

function compile(schema: unknown): ReturnType<typeof compileStructuredOutputSchema> {
  return compileStructuredOutputSchema(schema, collectingLogger().logger);
}

function compileOrThrow(schema: unknown): StructuredOutputValidator {
  const outcome = compile(schema);
  if (outcome.kind === 'error') {
    throw new Error(outcome.message);
  }
  return outcome.value;
}

describe('compileStructuredOutputSchema', () => {
  it('érvényes draft-07 sémát lefordít', () => {
    const outcome = compile({
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
    expect(compile(true).kind).toBe('ok');
  });

  it('két azonos `$id` értékű séma egymás után is lefordul (nincs közös példány)', () => {
    const schema = { $id: 'https://example.test/answer', type: 'object' };

    expect(compile(schema).kind).toBe('ok');
    expect(compile(schema).kind).toBe('ok');
  });

  it.each([
    ['draft 2020-12', 'https://json-schema.org/draft/2020-12/schema'],
    ['draft 2019-09', 'https://json-schema.org/draft/2019-09/schema'],
    // eslint-disable-next-line unicorn/prefer-https -- a meta-séma azonosítója szó szerint ez
    ['draft-04, a régebbi változat', 'http://json-schema.org/draft-04/schema#'],
  ])('a nem draft-07 $schema (%s) érvénytelen', (_name, metaSchema) => {
    expect(compile({ $schema: metaSchema, type: 'object' })).toEqual({
      kind: 'error',
      message: `A strukturált kimenet sémája érvénytelen: no schema with key or ref "${metaSchema}"`,
    });
  });

  it('a meta-sémára nem illeszkedő séma érvénytelen', () => {
    const outcome = compile({ type: 'strin' });

    expect(outcome.kind).toBe('error');
    expect(outcome.kind === 'error' && outcome.message).toMatch(
      /^A strukturált kimenet sémája érvénytelen: schema is invalid/u,
    );
  });

  it('strict módban az ismeretlen kulcsszó érvénytelen', () => {
    expect(compile({ type: 'object', answerType: 'string' })).toEqual({
      kind: 'error',
      message: 'A strukturált kimenet sémája érvénytelen: strict mode: unknown keyword: "answerType"',
    });
  });

  // eslint-disable-next-line unicorn/no-null -- a JSON `null` érték a tárolt séma mezőben előfordulhat
  it.each([['szöveg'], [42], [null], [[]]])('nem objektum és nem logikai séma érvénytelen: %j', (schema) => {
    expect(compile(schema)).toEqual({
      kind: 'error',
      message: 'A strukturált kimenet sémája érvénytelen: a séma nem objektum és nem logikai érték',
    });
  });

  it('az aszinkron séma érvénytelen', () => {
    expect(compile({ $async: true, type: 'object' })).toEqual({
      kind: 'error',
      message: 'A strukturált kimenet sémája érvénytelen: az aszinkron ($async) séma nem támogatott',
    });
  });
  describe('a `format` kulcsszó (ajv-formats, user döntés 2026-11-04)', () => {
    const contactSchema = {
      type: 'object',
      properties: { email: { type: 'string', format: 'email' }, sentAt: { type: 'string', format: 'date-time' } },
    };

    it('az érvényes email és date-time értéket elfogadja', () => {
      const validator = compileOrThrow(contactSchema);

      expect(validator({ email: 'anna@example.test', sentAt: '2026-11-04T10:15:00Z' })).toBe(true);
    });

    it('az érvénytelen email értéket elutasítja, a `format` kulcsszóval', () => {
      const validator = compileOrThrow(contactSchema);

      expect(validator({ email: 'nem-email-cim' })).toBe(false);
      expect(validator.errors?.[0]).toMatchObject({ instancePath: '/email', keyword: 'format' });
    });

    it('az érvénytelen date-time értéket elutasítja, a `format` kulcsszóval', () => {
      const validator = compileOrThrow(contactSchema);

      expect(validator({ sentAt: '2026-13-45' })).toBe(false);
      expect(validator.errors?.[0]).toMatchObject({ instancePath: '/sentAt', keyword: 'format' });
    });

    it('az ismeretlen format név strict módban fordítási hiba', () => {
      expect(compile({ type: 'string', format: 'nem-letezo' })).toEqual({
        kind: 'error',
        message: 'A strukturált kimenet sémája érvénytelen: unknown format "nem-letezo" ignored in schema at path "#"',
      });
    });
  });

  it('a strict mód figyelmeztetése a kapott naplózóba megy, a séma lefordul', () => {
    const { logger, warnings } = collectingLogger();

    const outcome = compileStructuredOutputSchema({ properties: { answer: { type: 'string' } } }, logger);

    expect(outcome.kind).toBe('ok');
    expect(warnings).toEqual([
      {
        bindings: {
          ajv: ['strict mode: missing type "object" for keyword "properties" at "#" (strictTypes)'],
        },
        message: 'A strukturált kimenet sémájának fordítója (Ajv) üzenetet adott.',
      },
    ]);
  });
});
