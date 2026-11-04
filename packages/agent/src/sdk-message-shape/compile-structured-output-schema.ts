import { Ajv } from 'ajv';
import addFormats from 'ajv-formats';
import { describeError } from '@easter-workflow-builder/core';
import type { Outcome } from '@easter-workflow-builder/core';
import { createAjvLogger } from './create-ajv-logger.ts';
import { isJsonSchemaDocument } from './is-json-schema-document.ts';
import type { StructuredOutputSchemaLogger } from './structured-output-schema-logger.ts';
import type { StructuredOutputValidator } from './structured-output-validator.ts';

const INVALID_SCHEMA_PREFIX = 'A strukturált kimenet sémája érvénytelen';

/**
 * A lépés `structuredOutput.schema` mezőjének fordítása (SPEC-015 5.2, 5.4).
 * Az Ajv alap osztálya draft-07 szerint fordít, alapból strict módban, és a
 * sémát a meta-sémára is ellenőrzi; csak a draft-07 meta-séma azonosítóját
 * ismeri (a `json-schema.org/draft-07/schema` azonosító `http` alakja), tehát a draft-07-nél
 * újabb (K-3, K-7), a régebbi és a más alakú `$schema` deklaráció is hibaág. Az `allErrors: false`
 * a K-8 ajánlása, a `logger` a projekt naplózójára irányítja a fordító üzeneteit (`createAjvLogger`),
 * minden más opció az Ajv alapértékén marad.
 *
 * A `format` kulcsszó ténylegesen ellenőrzött (user döntés 2026-11-04, SPEC-015 5.2): az
 * `ajv-formats` alapértelmezett hívása (`addFormats(ajv)`) a teljes (`full`) módú formátum listát
 * veszi fel (`email`, `date-time`, `uri` és társaik). Az ebben nem szereplő `format` név a strict mód
 * miatt fordítási hiba (`ajv/lib/vocabularies/format/format.ts` `unknownFormat`).
 *
 * Az `$async: true` séma ellenőrzője ígéretet ad vissza, amit a szinkron
 * `checkStructuredOutput` igaz értéknek látna, ezért az ilyen séma hibaág.
 *
 * Hívásonként új Ajv példány fordít: egy közös példány a lefordított sémákat
 * megtartaná, és két, azonos `$id` értékű séma a második fordításnál hibát
 * adna.
 */
export function compileStructuredOutputSchema(
  schema: unknown,
  logger: StructuredOutputSchemaLogger,
): Outcome<StructuredOutputValidator> {
  if (!isJsonSchemaDocument(schema)) {
    return { kind: 'error', message: `${INVALID_SCHEMA_PREFIX}: a séma nem objektum és nem logikai érték` };
  }
  const ajv = new Ajv({ allErrors: false, logger: createAjvLogger(logger) });
  addFormats(ajv);
  // A `compile` utolsó túlterhelése (`AnySchema` bemenet) az aszinkron ellenőrzőt is magában foglaló alak.
  let validator: ReturnType<Ajv['compile']>;
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
