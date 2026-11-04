import { isInt } from '@easter-workflow-builder/typeguards';
import { collectNumberFields } from './collect-number-fields.ts';

/**
 * Egy ponttal összefűzött mezőútvonal minden előfordulása közül azok konkrét
 * útvonala, ahol az érték nem egész szám a `minimum` és a `maximum` között
 * (mindkét határ megengedett): tört, a tartomány alatti vagy fölötti szám
 * (SPEC-014 5.3, a JavaScript szkript `memoryLimitMb` mezője). A bemenet
 * `unknown`, a nem szám értékre és a nem várt alakú útvonalra nincs találat, a
 * `findNonPositiveIntegerFields` mintájára: a típushibáról a séma dönt.
 */
export function findIntegerFieldsOutsideRange(
  value: unknown,
  path: string,
  minimum: number,
  maximum: number,
): readonly (readonly (string | number)[])[] {
  return collectNumberFields(
    value,
    path.split('.'),
    [],
    (candidate) => !(isInt(candidate) && candidate >= minimum && candidate <= maximum),
  );
}
