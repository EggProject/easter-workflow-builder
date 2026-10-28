import { isRecord } from '../is-record/is-record.ts';
import { isString } from '../is-string/is-string.ts';

/**
 * Szöveg értékű kulcs-érték objektum-e az érték: minden saját kulcsához
 * szöveg tartozik. A `packages/db` MCP név hozzárendelései (deklarált név ->
 * szerver oldali név, SPEC-009 6.1, 6.2) ilyen alakúak; a guardnak nincs
 * domain témája, ezért áll itt. Az üres objektum érvényes.
 */
export function isStringRecord(value: unknown): value is Readonly<Record<string, string>> {
  return isRecord(value) && Object.values(value).every((element: unknown) => isString(element));
}
