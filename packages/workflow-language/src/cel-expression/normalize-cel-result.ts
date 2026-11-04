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
 * A közös hivatkozás megmarad (user döntés 2026-10-25, O-15): ugyanarra a
 * forrás tömbre vagy objektumra egy híváson belül ugyanaz a normalizált érték
 * jön vissza. A CEL eredménye közös hivatkozású szerkezet lehet (`[x, x]`), és
 * a fává bontás memóriája a kifejezés hosszával exponenciálisan nő (research
 * 10.2). A gyorsítótárba csak a kész normalizált érték kerül.
 *
 * A körkörös adat (ami csak a kontextusból jöhet, a CEL nem épít ilyet) az
 * ősök láncán felismert, és `TypeError` kivételt dob, amit a hívó elkap
 * (SPEC-010 7.4: az `evaluate` elkapott kivétele, a közös hibamondat), az
 * ECMA-262 `JSON.stringify` körkörös ágának mintájára. A felismerés nem a verem
 * kifutására épül: a veremtúlcsordulás kivételének típusa a futtató állapotától
 * függ (`RangeError` vagy `TypeError`), ami a tesztet billegővé tette
 * (`docs/research/2026-10-28-cel-korkoros-bemenet.md`).
 *
 * A map literál nem string kulcsa már a könyvtárban stringgé alakul, a
 * `constructor`, `__proto__` és `prototype` kulcsa pedig eltűnik; a normalizálás
 * ezt nem látja és nem is tudja elutasítani (O-8, research 2. szekció (4), (7)).
 */
export function normalizeCelResult(value: unknown): Outcome<unknown> {
  return normalizeValue(value, new Map<object, unknown>(), new Set<object>());
}

/**
 * Egy érték normalizálása; a `normalized` a már kész tömb és objektum
 * normalizált párja a forrás hivatkozás szerint, az `ancestors` a gyökértől az
 * aktuális értékig vezető lánc konténerei: a láncban már álló konténer
 * körkörös hivatkozás, míg ugyanaz a konténer két testvér ágon nem az.
 */
function normalizeValue(value: unknown, normalized: Map<object, unknown>, ancestors: Set<object>): Outcome<unknown> {
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
  if (!Array.isArray(value) && !isPlainObject(value)) {
    return { kind: 'error', message: 'a kifejezés eredményében nem JSON érték áll' };
  }
  if (normalized.has(value)) {
    return { kind: 'ok', value: normalized.get(value) };
  }
  if (ancestors.has(value)) {
    throw new TypeError('körkörös hivatkozás a kifejezés eredményében');
  }
  ancestors.add(value);
  const outcome = Array.isArray(value)
    ? normalizeEntries(value.entries(), normalized, ancestors, (items) => items.map(([, item]) => item))
    : normalizeEntries(Object.entries(value), normalized, ancestors, (entries) => Object.fromEntries(entries));
  ancestors.delete(value);
  if (outcome.kind === 'ok') {
    normalized.set(value, outcome.value);
  }
  return outcome;
}

/**
 * A tömb elemeinek vagy az objektum értékeinek normalizálása; az első hibaág
 * visszajön, különben a `build` a normalizált párokból építi az új értéket.
 */
function normalizeEntries<TKey>(
  entries: Iterable<readonly [TKey, unknown]>,
  normalized: Map<object, unknown>,
  ancestors: Set<object>,
  build: (pairs: readonly (readonly [TKey, unknown])[]) => unknown,
): Outcome<unknown> {
  const pairs: (readonly [TKey, unknown])[] = [];
  for (const [key, item] of entries) {
    const outcome = normalizeValue(item, normalized, ancestors);
    if (outcome.kind === 'error') {
      return outcome;
    }
    pairs.push([key, outcome.value]);
  }
  return { kind: 'ok', value: build(pairs) };
}
