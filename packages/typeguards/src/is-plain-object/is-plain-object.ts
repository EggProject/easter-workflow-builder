/**
 * Sima objektum-e az érték: nem `null` objektum, aminek a prototípusa
 * `Object.prototype` vagy `null`. A tömb, az osztálypéldány, a `Map`, a `Date`
 * és a `Uint8Array` nem az, mert a prototípusuk más. Ebben különbözik az
 * `isRecord` guardtól, ami minden nem `null`, nem tömb objektumot átenged
 * (SPEC-010 7.4). Más realmból származó sima objektumot nem ismer fel, mert az
 * ottani `Object.prototype` másik objektum.
 */
export function isPlainObject(value: unknown): value is Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
