import { isString } from '@easter-workflow-builder/typeguards';
import type { ApprovalDecision } from './approval-decision.ts';

/**
 * A két ág kulcsonként. A `Record<ApprovalDecision, true>` annotáció miatt a
 * fordító hibát ad, ha az `ApprovalDecision` unió bővül, de ez a lista nem:
 * a guard így nem tud csendben lemaradni egy típusról (ugyanaz a minta, mint
 * a `workflow-run` téma `isRunStatus` guardjánál).
 */
const APPROVAL_DECISION_KEYS: Readonly<Record<ApprovalDecision, true>> = {
  approved: true,
  rejected: true,
};

/**
A két `ApprovalDecision` érték egyike-e a bemenet (SPEC-003 4.12 szekció, 9.4 szekció).
*/
export function isApprovalDecision(value: unknown): value is ApprovalDecision {
  return isString(value) && Object.hasOwn(APPROVAL_DECISION_KEYS, value);
}
