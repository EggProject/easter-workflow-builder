import { isPlainObject } from '@easter-workflow-builder/typeguards';

/**
 * A behelyettesített érték szöveggé alakítása (SPEC-010 6.5, O-5, user döntés
 * 2026-10-25: szigorú kiírás). A szöveg változatlan, a szám, a logikai érték és
 * a `null` `String(value)`, a tömb és a sima objektum (prototípus alapú
 * felismeréssel) `JSON.stringify(value)` alakot kap. Minden más értékre (`Map`,
 * `Date`, osztálypéldány, `BigInt`, `Symbol`) `undefined` a válasz: ezt a hívó
 * hibaágra viszi, a nevet megnevezve.
 *
 * A vizsgálat csak a feloldott értékre szól, a tömb elemeire és az objektum
 * mezőire nem (6.5, nyitott a mélység kérdése). A beágyazott, nem JSON értéket
 * ezért a `JSON.stringify` saját szabálya kezeli: a körkörös hivatkozásra és a
 * beágyazott `BigInt` értékre kivételt dob, amit a renderelő a közös tartalék
 * mondatra képez (`describeTemplateError`).
 */
export function toText(value: unknown): string | undefined {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return String(value);
  }
  return Array.isArray(value) || isPlainObject(value) ? JSON.stringify(value) : undefined;
}
