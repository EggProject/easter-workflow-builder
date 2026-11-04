import { describe, expect, it } from 'vitest';
import { isStructuredOutputSchemaFieldPath } from './is-structured-output-schema-field-path.ts';
import type { RejectedStructuredOutputSchema } from './rejected-structured-output-schema.ts';

describe('isStructuredOutputSchemaFieldPath', () => {
  it.each([['structuredOutput.schema'], ['settings.structuredOutput.schema']])('igazat ad és szűkít: %s', (value) => {
    const candidate: unknown = value;

    expect(isStructuredOutputSchemaFieldPath(candidate)).toBe(true);
    if (isStructuredOutputSchemaFieldPath(candidate)) {
      const fieldPath: RejectedStructuredOutputSchema['fieldPath'] = candidate;
      expect(fieldPath).toBe(value);
    }
  });

  it.each([['structuredOutput.strategy'], ['schema'], [undefined], [42]])('hamisat ad: %s', (value) => {
    expect(isStructuredOutputSchemaFieldPath(value)).toBe(false);
  });
});
