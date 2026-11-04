import { isString } from '@easter-workflow-builder/typeguards';
import type { StartInputValueKind } from './start-input-value-kind.ts';

/**
 * A hat ág kulcsonként. A `Record<StartInputValueKind, true>` annotáció miatt a
 * fordító hibát ad, ha az unió bővül, de ez a lista nem: a guard így nem tud
 * csendben lemaradni egy értékről (ugyanaz a minta, mint az `is-node-type.ts`
 * `NODE_TYPE_KEYS`-e).
 */
const START_INPUT_VALUE_KIND_KEYS: Readonly<Record<StartInputValueKind, true>> = {
  text: true,
  number: true,
  boolean: true,
  choice: true,
  list: true,
  json: true,
};

/**
 * A hat `StartInputValueKind` érték egyike-e a bemenet (SPEC-016 5.2).
 */
export function isStartInputValueKind(value: unknown): value is StartInputValueKind {
  return isString(value) && Object.hasOwn(START_INPUT_VALUE_KIND_KEYS, value);
}
