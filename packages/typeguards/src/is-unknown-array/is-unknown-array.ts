/**
 * Tömb-e az érték, elemenként `unknown` típussal. Az `Array.isArray` a
 * szűkítést `any[]` típusra adja, amit a `no-unsafe-*` szabályok nem engednek
 * tovább; ez a guard `readonly unknown[]` típusra szűkít.
 */
export function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}
