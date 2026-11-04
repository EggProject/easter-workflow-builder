import type { ErrorObject } from 'ajv';

/**
 * Az ellenőrzés első hibájának leírása (SPEC-015 5.5): az útvonal és a nem
 * teljesült kulcsszó, plusz az Ajv saját szövege. Az `allErrors: false` miatt
 * legfeljebb egy hiba van. Ha az ellenőrző hiba nélkül jelez eltérést (az Ajv
 * `errors` mezőjének típusa ezt megengedi), a leírás ezt mondja ki, útvonal
 * nélkül.
 */
export function describeStructuredOutputMismatch(errors: readonly ErrorObject[] | null | undefined): string {
  const first = errors?.[0];
  if (first === undefined) {
    return 'A kimenet nem illeszkedik a strukturált kimenet sémájára';
  }
  const path = first.instancePath === '' ? 'gyökér' : first.instancePath;
  return `A kimenet nem illeszkedik a strukturált kimenet sémájára: a(z) "${path}" útvonalon a(z) "${first.keyword}" kulcsszó nem teljesül (${first.message ?? 'nincs részletezés'})`;
}
