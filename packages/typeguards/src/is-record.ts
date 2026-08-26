/**
 * Kulcs-érték objektum-e az érték. A `null` és a tömb kifejezetten nem az:
 * mindkettőre igazat adna a puszta `typeof value === 'object'` vizsgálat, ami a
 * hívó oldalon néma hibához vezetne. Ismeretlen alakú JSON válasz szűkítéséhez
 * ez az első lépés, `as` kényszerítés nélkül.
 */
export function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
