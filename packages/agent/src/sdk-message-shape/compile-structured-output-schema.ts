import { Ajv } from 'ajv';
import { describeError } from '@easter-workflow-builder/core';
import type { Outcome } from '@easter-workflow-builder/core';
import { isJsonSchemaDocument } from './is-json-schema-document.ts';
import type { StructuredOutputValidator } from './structured-output-validator.ts';

const INVALID_SCHEMA_PREFIX = 'A strukturált kimenet sémája érvénytelen';

/**
 * A lépés `structuredOutput.schema` mezőjének fordítása (SPEC-015 5.2, 5.4).
 * Az Ajv alap osztálya draft-07 szerint fordít, alapból strict módban, és a
 * sémát a meta-sémára is ellenőrzi; a draft-07-nél újabb `$schema`
 * deklarációt nem ismeri, tehát az is hibaág (K-3, K-7). Az `allErrors: false`
 * a K-8 ajánlása, minden más opció az Ajv alapértékén marad.
 *
 * Az `$async: true` séma ellenőrzője ígéretet ad vissza, amit a szinkron
 * `checkStructuredOutput` igaz értéknek látna, ezért az ilyen séma hibaág.
 *
 * Hívásonként új Ajv példány fordít: egy közös példány a lefordított sémákat
 * megtartaná, és két, azonos `$id` értékű séma a második fordításnál hibát
 * adna.
 */
export function compileStructuredOutputSchema(schema: unknown): Outcome<StructuredOutputValidator> {
  if (!isJsonSchemaDocument(schema)) {
    return { kind: 'error', message: `${INVALID_SCHEMA_PREFIX}: a séma nem objektum és nem logikai érték` };
  }
  const ajv = new Ajv({ allErrors: false });
  let validator;
  try {
    validator = ajv.compile(schema);
  } catch (error) {
    return { kind: 'error', message: `${INVALID_SCHEMA_PREFIX}: ${describeError(error)}` };
  }
  if ('$async' in validator) {
    return { kind: 'error', message: `${INVALID_SCHEMA_PREFIX}: az aszinkron ($async) séma nem támogatott` };
  }
  return { kind: 'ok', value: validator };
}
