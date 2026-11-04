import type { AnySchema } from 'ajv';
import { isBoolean, isRecord } from '@easter-workflow-builder/typeguards';

/**
 * Lehet-e a bemenet JSON Schema dokumentum az Ajv számára: objektum vagy
 * logikai érték (draft-07 4.3.2, a logikai séma). Csak az alakot nézi; a
 * tartalmat (kulcsszavak, meta-séma) a fordítás ellenőrzi
 * (`compileStructuredOutputSchema`).
 */
export function isJsonSchemaDocument(value: unknown): value is AnySchema {
  return isBoolean(value) || isRecord(value);
}
