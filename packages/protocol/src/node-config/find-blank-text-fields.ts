import { isRecord, isString } from '@easter-workflow-builder/typeguards';

function collectBlankTextFields(
  value: unknown,
  segments: readonly string[],
  prefix: readonly (string | number)[],
): readonly (readonly (string | number)[])[] {
  const [head, ...rest] = segments;
  if (head === undefined) {
    return isString(value) && value.trim() === '' ? [prefix] : [];
  }
  if (head === '*') {
    return Array.isArray(value)
      ? value.flatMap((element: unknown, index: number) => collectBlankTextFields(element, rest, [...prefix, index]))
      : [];
  }
  return isRecord(value) ? collectBlankTextFields(value[head], rest, [...prefix, head]) : [];
}

/**
 * Egy ponttal összefűzött mezőútvonal (`branches.*.key`, a lista minden
 * elemén `*`) minden előfordulása közül azok konkrét útvonala
 * (`['branches', 0, 'key']`), ahol a szöveg üres vagy csak szóközből áll.
 * Az "üres" jelentése ugyanaz, mint az `apps/web` `nullable-text-field-value.ts`
 * szabályában (`trim()` után üres, SPEC-008 5.4).
 *
 * A bemenet `unknown`: ahol az útvonal nem a várt alakra mutat (nem lista
 * a `*` helyén, nem objektum a kulcs előtt, nem szöveg a végén), ott nincs
 * találat. A kötelező mező szabály így kizárólag a szöveg tartalmáról dönt,
 * az alakról a séma maga.
 */
export function findBlankTextFields(value: unknown, path: string): readonly (readonly (string | number)[])[] {
  return collectBlankTextFields(value, path.split('.'), []);
}
