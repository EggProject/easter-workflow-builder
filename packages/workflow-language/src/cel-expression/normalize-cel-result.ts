import type { Outcome } from '@easter-workflow-builder/core';
import { isPlainObject } from '@easter-workflow-builder/typeguards';

const MIN_SAFE_INTEGER = BigInt(Number.MIN_SAFE_INTEGER);
const MAX_SAFE_INTEGER = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * A kiértékelés eredményének normalizálása JSON értékre (SPEC-010 7.4). A
 * szöveg, a logikai érték, a `null` és a véges szám változatlan; a `NaN` és a
 * végtelen hiba; a `BigInt` (`int`) a biztonságos egész tartományban szám,
 * azon kívül hiba; a tömb elemenként, a sima objektum (prototípus alapú
 * felismeréssel) értékenként normalizált, új értékként, a bemenet módosítása
 * nélkül; minden más (`uint`, `bytes`, időbélyeg, időtartam, típus érték, `Map`,
 * osztálypéldány) hiba. A hibaág szövege megnevezi, mi nem normalizálható, a
 * kifejezés és az adat darabja nélkül (9.5).
 *
 * A map literál nem string kulcsa már a könyvtárban stringgé alakul, a
 * `constructor`, `__proto__` és `prototype` kulcsa pedig eltűnik; a normalizálás
 * ezt nem látja és nem is tudja elutasítani (O-8, research 2. szekció (4), (7)).
 */
export function normalizeCelResult(value: unknown): Outcome<unknown> {
  if (typeof value === 'string' || typeof value === 'boolean' || value === null) {
    return { kind: 'ok', value };
  }
  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? { kind: 'ok', value }
      : { kind: 'error', message: 'a kifejezés eredményében nem véges szám áll, ami JSON-ban nem ábrázolható' };
  }
  if (typeof value === 'bigint') {
    return value >= MIN_SAFE_INTEGER && value <= MAX_SAFE_INTEGER
      ? { kind: 'ok', value: Number(value) }
      : { kind: 'error', message: 'a kifejezés eredményében a biztonságos tartományon kívüli egész szám áll' };
  }
  if (Array.isArray(value)) {
    return normalizeEntries(value.entries(), (items) => items.map(([, item]) => item));
  }
  if (isPlainObject(value)) {
    return normalizeEntries(Object.entries(value), (entries) => Object.fromEntries(entries));
  }
  return { kind: 'error', message: 'a kifejezés eredményében nem JSON érték áll' };
}

/**
 * A tömb elemeinek vagy az objektum értékeinek normalizálása; az első hibaág
 * visszajön, különben a `build` a normalizált párokból építi az új értéket.
 */
function normalizeEntries<TKey>(
  entries: Iterable<readonly [TKey, unknown]>,
  build: (normalized: readonly (readonly [TKey, unknown])[]) => unknown,
): Outcome<unknown> {
  const normalized: (readonly [TKey, unknown])[] = [];
  for (const [key, item] of entries) {
    const outcome = normalizeCelResult(item);
    if (outcome.kind === 'error') {
      return outcome;
    }
    normalized.push([key, outcome.value]);
  }
  return { kind: 'ok', value: build(normalized) };
}
