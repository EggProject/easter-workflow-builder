import { describe, expect, it } from 'vitest';
import type { AnySchema } from 'ajv';
import { isJsonSchemaDocument } from './is-json-schema-document.ts';

describe('isJsonSchemaDocument', () => {
  it('igazat ad objektumra és szűkít', () => {
    const value: unknown = { type: 'object' };

    expect(isJsonSchemaDocument(value)).toBe(true);
    if (isJsonSchemaDocument(value)) {
      const schema: AnySchema = value;
      expect(schema).toEqual({ type: 'object' });
    }
  });

  it('igazat ad a logikai sémára', () => {
    expect(isJsonSchemaDocument(true)).toBe(true);
    expect(isJsonSchemaDocument(false)).toBe(true);
  });

  // eslint-disable-next-line unicorn/no-null -- a JSON `null` érték a tárolt séma mezőben előfordulhat
  it.each([['szöveg'], [42], [null], [undefined], [[{ type: 'object' }]]])('hamisat ad: %j', (value) => {
    expect(isJsonSchemaDocument(value)).toBe(false);
  });
});
