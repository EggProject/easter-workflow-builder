/**
 * Nem üres string-e az érték. Az üres string a legtöbb hívási helyen ugyanúgy
 * hiányzó adat, mint a `undefined`, ezért a kettőt egyszerre zárja ki.
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
