import type { ProtocolErrorBody } from './protocol-error-body.ts';

/**
 * A `zodErrorToProtocolErrorBody` mezőlistás üzenetének alakja: a lista a
 * kettőspont és a záró `(invalid_request).` között áll, vesszővel és szóközzel
 * elválasztva.
 */
const FIELD_LIST_PATTERN = /^A kérés törzse érvénytelen, hibás mező\(k\): (?<paths>.+) \(invalid_request\)\.$/u;

/**
 * Az `invalid_request` hiba törzsének mezőútjai, a `zodErrorToProtocolErrorBody`
 * kimenetének visszafejtéseként (a kettő párja egy csomagban áll, a
 * kölcsönösségüket a teszt őrzi). Más kódra, vagy a mezőlista nélküli üzenetre
 * üres lista.
 *
 * Egyetlen hívója a gráf mentése a kliensen, ami a strukturált kimenet
 * sémájának szerver oldali elutasítását a mező alatt jelzi (SPEC-015 5.7); a
 * kliens a mezőutat nem jeleníti meg, csak a mezőt keresi meg vele.
 */
export function readInvalidRequestFieldPaths(body: ProtocolErrorBody): readonly string[] {
  if (body.code !== 'invalid_request') {
    return [];
  }
  const paths = FIELD_LIST_PATTERN.exec(body.message)?.groups?.['paths'];
  return paths === undefined ? [] : paths.split(', ');
}
