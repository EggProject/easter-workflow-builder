import { isJsonValue } from './is-json-value.ts';

/**
 * A behelyettesített érték szöveggé alakítása (SPEC-010 6.5, O-5, O-13, user
 * döntés 2026-10-25: mélyen szigorú kiírás). A szöveg változatlan, a véges
 * szám, a logikai érték és a `null` `String(value)`, a tömb és a sima objektum
 * (prototípus alapú felismeréssel) `JSON.stringify(value)` alakot kap. Minden
 * más értékre `undefined` a válasz: ezt a hívó hibaágra viszi, a nevet
 * megnevezve.
 *
 * A vizsgálat (`isJsonValue`) a tömb elemeire és az objektum mezőire is
 * rekurzívan kiterjed, a körkörös hivatkozást is elutasítja, ezért a
 * `JSON.stringify` csak olyan értéket kap, aminél nem dobhat kivételt.
 */
export function toText(value: unknown): string | undefined {
  if (!isJsonValue(value)) {
    return undefined;
  }
  return typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);
}
