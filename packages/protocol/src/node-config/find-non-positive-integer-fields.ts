import { isInt, isNumber, isRecord } from '@easter-workflow-builder/typeguards';

function collectNonPositiveIntegerFields(
  value: unknown,
  segments: readonly string[],
  prefix: readonly (string | number)[],
): readonly (readonly (string | number)[])[] {
  const [head, ...rest] = segments;
  if (head === undefined) {
    return isNumber(value) && !(isInt(value) && value > 0) ? [prefix] : [];
  }
  if (head === '*') {
    return Array.isArray(value)
      ? value.flatMap((element: unknown, index: number) =>
          collectNonPositiveIntegerFields(element, rest, [...prefix, index]),
        )
      : [];
  }
  return isRecord(value) ? collectNonPositiveIntegerFields(value[head], rest, [...prefix, head]) : [];
}

/**
 * Egy ponttal összefűzött mezőútvonal (`backoffMs.*`, a lista minden elemén
 * `*`) minden előfordulása közül azok konkrét útvonala (`['backoffMs', 1]`),
 * ahol a szám nem pozitív egész: nulla, negatív vagy tört (SPEC-008 5.4,
 * O-37). A "pozitív egész" jelentése a `db` `isNodeConfig` guardjáé
 * (SPEC-003 4.3): ugyanaz a `typeguards` `isInt` guard, plusz a `> 0`
 * feltétel.
 *
 * A bemenet `unknown`, és csak véges szám értéken van találat: a nem szám, a
 * `NaN` és a végtelen érték a séma saját típushibája (`z.number()`), tehát a
 * mező nem kap mellé második hibát. Ahol az útvonal nem a várt alakra mutat
 * (nem lista a `*` helyén, nem objektum a kulcs előtt), ott sincs találat, a
 * `findBlankTextFields` mintájára.
 */
export function findNonPositiveIntegerFields(value: unknown, path: string): readonly (readonly (string | number)[])[] {
  return collectNonPositiveIntegerFields(value, path.split('.'), []);
}
