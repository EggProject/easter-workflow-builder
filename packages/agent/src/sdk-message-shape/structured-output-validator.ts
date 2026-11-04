import type { ValidateFunction } from 'ajv';

/**
 * Egy lépés strukturált kimenet sémájának lefordított ellenőrzője (SPEC-015
 * 5.2). A `compileStructuredOutputSchema` állítja elő, a
 * `checkStructuredOutput` futtatja; a hívó csak továbbadja, belső mezőit nem
 * olvassa.
 */
export type StructuredOutputValidator = ValidateFunction;
