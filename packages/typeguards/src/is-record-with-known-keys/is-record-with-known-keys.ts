import { isRecord } from '../is-record/is-record.ts';

/**
 * Kulcs-érték objektum-e az érték, amelynek MINDEN saját kulcsa a megadott
 * ismert kulcsok egyike. A hiányzó kulcsot nem vizsgálja (az a hívó mezőnkénti
 * ellenőrzésének dolga), csak azt, hogy ismeretlen kulcs ne legyen.
 *
 * A `knownKeys` a `Readonly<Record<keyof T, true>>` mintájú táblát várja: a
 * hívó így annotálva a fordító hibát ad, ha a `T` típus bővül, de a tábla nem.
 * A szűkített típus `Partial`, mert a kulcsok jelenlétét a guard nem igazolja.
 */
export function isRecordWithKnownKeys<TKey extends string>(
  value: unknown,
  knownKeys: Readonly<Record<TKey, true>>,
): value is Readonly<Partial<Record<TKey, unknown>>> {
  return isRecord(value) && Object.keys(value).every((key) => Object.hasOwn(knownKeys, key));
}
