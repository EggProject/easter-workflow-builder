import { copyJsonValue } from './copy-json-value.ts';

/**
 * A behelyettesített érték szöveggé alakítása (SPEC-010 6.5, O-5, O-13, user
 * döntés 2026-10-25: mélyen szigorú kiírás). A szöveg változatlan, a véges
 * szám, a logikai érték és a `null` `String(value)`, a tömb és a sima objektum
 * (prototípus alapú felismeréssel) `JSON.stringify` alakot kap. Minden más
 * értékre `undefined` a válasz: ezt a hívó hibaágra viszi, a nevet megnevezve.
 *
 * A vizsgálat (`copyJsonValue`) a tömb elemeire és az objektum mezőire is
 * rekurzívan kiterjed, a körkörös hivatkozást is elutasítja, és a bejárt adat
 * tiszta másolatát adja: a `JSON.stringify` ezt kapja, nem a bemenetet, ezért
 * a kiírt szöveg a vizsgált adatból áll, és egy `toJSON` sem futhat le.
 *
 * A másolat közös hivatkozása megmarad (user döntés 2026-10-25, O-16), a
 * `JSON.stringify` viszont újra kibontja: a szöveg mérete a szerkezethez képest
 * exponenciálisan nőhet, a legnagyobb szöveghossznál `RangeError` kivétellel.
 * Ezt a hívó (`render`) kapja el, és hibaágra viszi (6.5).
 */
export function toText(value: unknown): string | undefined {
  const copy = copyJsonValue(value);
  if (copy === undefined) {
    return undefined;
  }
  return typeof copy === 'object' && copy !== null ? JSON.stringify(copy) : String(copy);
}
