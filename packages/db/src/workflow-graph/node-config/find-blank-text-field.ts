import { isRecord, isString } from '@easter-workflow-builder/typeguards';

function findInSegments(value: unknown, segments: readonly string[], prefix: string): string | undefined {
  const [head, ...rest] = segments;
  if (head === undefined) {
    return isString(value) && value.trim() === '' ? prefix : undefined;
  }
  const childPrefix = (key: string): string => (prefix === '' ? key : `${prefix}.${key}`);
  if (head === '*') {
    if (!Array.isArray(value)) {
      return undefined;
    }
    for (const [index, element] of value.entries()) {
      const found = findInSegments(element, rest, childPrefix(String(index)));
      if (found !== undefined) {
        return found;
      }
    }
    return undefined;
  }
  return isRecord(value) ? findInSegments(value[head], rest, childPrefix(head)) : undefined;
}

/**
 * Egy ponttal összefűzött mezőútvonal (`branches.*.key`, a lista minden
 * elemén `*`) első olyan előfordulásának konkrét útvonala (`branches.0.key`),
 * ahol a szöveg üres vagy csak szóközből áll (`trim()` után üres); ha
 * nincs ilyen, `undefined`. A bemenet `unknown`: ahol az útvonal nem a várt
 * alakra mutat (nem lista a `*` helyén, nem objektum a kulcs előtt, nem
 * szöveg a végén), ott nincs találat, mert az alakról az `isNodeConfig`
 * guard dönt, nem ez a függvény.
 */
export function findBlankTextField(value: unknown, path: string): string | undefined {
  return findInSegments(value, path.split('.'), '');
}
