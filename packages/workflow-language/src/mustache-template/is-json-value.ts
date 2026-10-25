import { isPlainObject } from '@easter-workflow-builder/typeguards';
import type { JsonValue } from './json-value.ts';

/**
 * A rekurzív vizsgálat. Az `ancestors` a tömb és objektum gyökértől az aktuális
 * értékig vezető láncot adja: a láncban már álló konténer körkörös hivatkozás,
 * míg ugyanaz a konténer két testvér ágon (közös hivatkozás) nem az, mert a
 * `JSON.stringify` azt rendben kiírja. A mezőket a tulajdonság leírón át
 * olvassuk, így egy getter sem fut le (6.6 mintája); a getteres tulajdonság és
 * a tömb lyuka nem JSON adat.
 */
function isJsonValueWithin(value: unknown, ancestors: readonly object[]): boolean {
  if (typeof value === 'string' || typeof value === 'boolean' || value === null) {
    return true;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  if (!Array.isArray(value) && !isPlainObject(value)) {
    return false;
  }
  if (ancestors.includes(value)) {
    return false;
  }
  const chain = [...ancestors, value];
  const keys = Array.isArray(value)
    ? Array.from({ length: value.length }, (_, index) => String(index))
    : Object.keys(value);
  return keys.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !('value' in descriptor)) {
      return false;
    }
    const child: unknown = descriptor.value;
    return isJsonValueWithin(child, chain);
  });
}

/**
 * Az érték minden mélységben JSON-ban ábrázolható-e (SPEC-010 6.5, user döntés
 * 2026-10-25: a szigorú kiírás mélyen is szigorú). Szöveg, véges szám, logikai
 * érték és `null` az; a tömb és a sima objektum (prototípus alapú felismeréssel)
 * akkor, ha minden eleme és mezője az, és nem tartalmaz körkörös hivatkozást.
 * Bármi más (`Map`, `Date`, osztálypéldány, `BigInt`, `Symbol`, függvény,
 * `Uint8Array`, `undefined`, `NaN`, végtelen) nem.
 */
export function isJsonValue(value: unknown): value is JsonValue {
  return isJsonValueWithin(value, []);
}
