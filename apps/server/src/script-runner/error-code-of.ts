import { isRecord, isString } from '@easter-workflow-builder/typeguards';

/**
 * A Node rendszerhiba `code` mezője (például `ENOENT`), ha van; a fájl gazda
 * függvények ebből építik a sandbox hibaüzenetét, a gazda útvonalat tartalmazó
 * `message` helyett.
 */
export function errorCodeOf(error: unknown): string | undefined {
  return isRecord(error) && isString(error['code']) ? error['code'] : undefined;
}
