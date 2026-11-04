import { isInt } from '@easter-workflow-builder/typeguards';
import { collectNumberFields } from './collect-number-fields.ts';

/**
 * Egy ponttal összefűzött mezőútvonal minden előfordulása közül azok konkrét
 * útvonala, ahol az érték egész szám és nagyobb a megadott felső határnál
 * (SPEC-014 5.3, a JavaScript szkript `timeoutMs` mezője). A nem egész szám
 * szándékosan kimarad: azt a `findNonPositiveIntegerFields` már jelzi, így a
 * mező nem kap két hibát. A bemenet `unknown`, a nem szám értékre és a nem várt
 * alakú útvonalra nincs találat, a `findNonPositiveIntegerFields` mintájára.
 */
export function findIntegerFieldsAbove(
  value: unknown,
  path: string,
  maximum: number,
): readonly (readonly (string | number)[])[] {
  return collectNumberFields(value, path.split('.'), [], (candidate) => isInt(candidate) && candidate > maximum);
}
