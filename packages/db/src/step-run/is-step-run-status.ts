import { isString } from '@easter-workflow-builder/typeguards';
import type { StepRunStatus } from './step-run-status.ts';

/**
 * A nyolc ág kulcsonként. A `Record<StepRunStatus, true>` annotáció miatt a
 * fordító hibát ad, ha a `StepRunStatus` unió bővül, de ez a lista nem: a
 * guard így nem tud csendben lemaradni egy típusról (ugyanaz a minta, mint a
 * `workflow-run` téma `isRunStatus` guardjánál).
 */
const STEP_RUN_STATUS_KEYS: Readonly<Record<StepRunStatus, true>> = {
  pending: true,
  running: true,
  waiting_approval: true,
  succeeded: true,
  failed: true,
  rejected: true,
  cancelled: true,
  interrupted: true,
};

/**
A nyolc `StepRunStatus` érték egyike-e a bemenet (SPEC-003 7.2 szekció).
*/
export function isStepRunStatus(value: unknown): value is StepRunStatus {
  return isString(value) && Object.hasOwn(STEP_RUN_STATUS_KEYS, value);
}
