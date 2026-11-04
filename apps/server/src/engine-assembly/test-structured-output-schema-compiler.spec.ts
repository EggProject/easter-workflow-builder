import { describe, expect, it } from 'vitest';
import { TEST_STRUCTURED_OUTPUT_SCHEMA_COMPILER } from './test-structured-output-schema-compiler.ts';

describe('TEST_STRUCTURED_OUTPUT_SCHEMA_COMPILER', () => {
  it('a valódi fordító: a strict figyelmeztetést adó séma is lefordul, a naplósor eldobva', () => {
    const outcome = TEST_STRUCTURED_OUTPUT_SCHEMA_COMPILER.compile({ properties: { answer: { type: 'string' } } });

    expect(outcome.kind).toBe('ok');
    expect(TEST_STRUCTURED_OUTPUT_SCHEMA_COMPILER.compile({ type: 'strin' }).kind).toBe('error');
  });
});
