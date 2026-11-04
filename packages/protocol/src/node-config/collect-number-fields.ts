import { isNumber, isRecord } from '@easter-workflow-builder/typeguards';

/**
 * Egy ponttal összefűzött mezőútvonal (`backoffMs.*`) szegmenseinek bejárása:
 * azoknak a számoknak a konkrét útvonala (`['backoffMs', 1]`), amikre a
 * `isViolation` igazat ad. A bemenet `unknown`: ahol az útvonal nem a várt alakra
 * mutat (nem lista a `*` helyén, nem objektum a kulcs előtt), vagy az érték nem
 * szám, ott nincs találat, tehát a típushibáról a séma dönt.
 */
export function collectNumberFields(
  value: unknown,
  segments: readonly string[],
  prefix: readonly (string | number)[],
  isViolation: (candidate: number) => boolean,
): readonly (readonly (string | number)[])[] {
  const [head, ...rest] = segments;
  if (head === undefined) {
    return isNumber(value) && isViolation(value) ? [prefix] : [];
  }
  if (head === '*') {
    return Array.isArray(value)
      ? value.flatMap((element: unknown, index: number) =>
          collectNumberFields(element, rest, [...prefix, index], isViolation),
        )
      : [];
  }
  return isRecord(value) ? collectNumberFields(value[head], rest, [...prefix, head], isViolation) : [];
}
