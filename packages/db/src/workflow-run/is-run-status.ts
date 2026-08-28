import { isString } from '@easter-workflow-builder/typeguards';
import type { RunStatus } from './run-status.ts';

/**
 * A hat ág kulcsonként. A `Record<RunStatus, true>` annotáció miatt a
 * fordító hibát ad, ha a `RunStatus` unió bővül, de ez a lista nem: a guard
 * így nem tud csendben lemaradni egy típusról (ugyanaz a minta, mint a
 * `workflow-graph` téma `isNodeType` guardjánál).
 */
const RUN_STATUS_KEYS: Readonly<Record<RunStatus, true>> = {
  pending: true,
  running: true,
  succeeded: true,
  failed: true,
  cancelled: true,
  interrupted: true,
};

/**
A hat `RunStatus` érték egyike-e a bemenet (SPEC-003 7.1 szekció).
*/
export function isRunStatus(value: unknown): value is RunStatus {
  return isString(value) && Object.hasOwn(RUN_STATUS_KEYS, value);
}
