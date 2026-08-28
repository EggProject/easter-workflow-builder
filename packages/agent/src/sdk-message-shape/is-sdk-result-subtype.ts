import { isString } from '@easter-workflow-builder/typeguards';
import type { SdkResultSubtype } from './sdk-result-subtype.ts';

/**
 * Az öt kulcs, ugyanazzal a mintával, mint az `is-node-type.ts` `NODE_TYPE_KEYS`-e
 * a `packages/db` csomagban: a `Record<SdkResultSubtype, true>` annotáció miatt
 * a fordító hibát ad, ha az unió bővül, de ez a lista nem: a guard így nem tud
 * csendben lemaradni egy értékről.
 */
const SDK_RESULT_SUBTYPE_KEYS: Readonly<Record<SdkResultSubtype, true>> = {
  success: true,
  error_during_execution: true,
  error_max_turns: true,
  error_max_budget_usd: true,
  error_max_structured_output_retries: true,
};

/**
Az öt `SdkResultSubtype` érték egyike-e a bemenet (SPEC-004 3.3, 2. szekció F-3 tény).
*/
export function isSdkResultSubtype(value: unknown): value is SdkResultSubtype {
  return isString(value) && Object.hasOwn(SDK_RESULT_SUBTYPE_KEYS, value);
}
