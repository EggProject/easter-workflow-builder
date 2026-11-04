import { describe, expect, it } from 'vitest';
import { checkStructuredOutput } from './check-structured-output.ts';
import { compileStructuredOutputSchema } from './compile-structured-output-schema.ts';
import type { StructuredOutputSchemaLogger } from './structured-output-schema-logger.ts';
import type { StructuredOutputValidator } from './structured-output-validator.ts';

function ignoreLogLine(): void {
  // szándékosan üres: a teszt nem a fordító naplóját vizsgálja
}

const SILENT_LOGGER: StructuredOutputSchemaLogger = { info: ignoreLogLine, warn: ignoreLogLine, error: ignoreLogLine };

function compile(schema: unknown): StructuredOutputValidator {
  const outcome = compileStructuredOutputSchema(schema, SILENT_LOGGER);
  if (outcome.kind === 'error') {
    throw new Error(outcome.message);
  }
  return outcome.value;
}

const answerSchema = {
  type: 'object',
  properties: { answer: { type: 'string' }, score: { type: 'number', minimum: 0 } },
  required: ['answer'],
};

describe('checkStructuredOutput', () => {
  it('illeszkedő kimenetre `ok`', () => {
    expect(checkStructuredOutput(compile(answerSchema), { answer: 'igen', score: 3 })).toEqual({
      kind: 'ok',
      value: undefined,
    });
  });

  it('rossz típusú mezőnél az útvonalat és a kulcsszót nevezi meg', () => {
    expect(checkStructuredOutput(compile(answerSchema), { answer: 42 })).toEqual({
      kind: 'error',
      message:
        'A kimenet nem illeszkedik a strukturált kimenet sémájára: a(z) "/answer" útvonalon a(z) "type" kulcsszó nem teljesül (must be string)',
    });
  });

  it('hiányzó kötelező mezőnél a gyökér útvonalat és a `required` kulcsszót nevezi meg', () => {
    expect(checkStructuredOutput(compile(answerSchema), {})).toEqual({
      kind: 'error',
      message:
        'A kimenet nem illeszkedik a strukturált kimenet sémájára: a(z) "gyökér" útvonalon a(z) "required" kulcsszó nem teljesül (must have required property \'answer\')',
    });
  });

  it('a dekódolásban nem kényszerített kulcsszót (`minimum`) is ellenőrzi', () => {
    const outcome = checkStructuredOutput(compile(answerSchema), { answer: 'igen', score: -1 });

    expect(outcome.kind === 'error' && outcome.message).toContain('a(z) "/score" útvonalon a(z) "minimum" kulcsszó');
  });
});
