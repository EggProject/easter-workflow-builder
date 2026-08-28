import type { StepRunStatus } from './step-run-status.ts';

const PENDING_TARGETS: ReadonlySet<StepRunStatus> = new Set(['running', 'cancelled', 'interrupted']);
const RUNNING_TARGETS: ReadonlySet<StepRunStatus> = new Set([
  'waiting_approval',
  'succeeded',
  'failed',
  'cancelled',
  'interrupted',
]);
const WAITING_APPROVAL_TARGETS: ReadonlySet<StepRunStatus> = new Set([
  'succeeded',
  'rejected',
  'failed',
  'cancelled',
  'interrupted',
]);

/**
 * A lépés futás állapotgép engedélyezett átmenetei (SPEC-003 7.2 táblázat,
 * 22. és 23. kritérium). A `succeeded`, `failed`, `rejected`, `cancelled` és
 * `interrupted` terminális: nincs belőlük kimenő átmenet, ezért egy közös
 * `case` ággal térnek vissza. A kimerítő `switch` a `from` mind a nyolc ágát
 * lefedi, a fordító `switch-exhaustiveness-check` szabálya hibát ad, ha a
 * `StepRunStatus` unió bővül, és az új ág innen hiányzik.
 *
 * **A `waiting_approval -> failed` átmenet a SPEC-003 eredeti 7.2 táblázatában
 * nem szerepelt, a SPEC-004 5.8 szekció (`human_approval` időkorlát, PLAN-005
 * T-005-22) viszont kimondja: lejáratkor "a lépés `failed` állapotban zár,
 * `approval_timed_out` hibaosztállyal". A hiány a SPEC-003 lezárásakor még nem
 * derült ki, mert az időkorlátos várakozás motor oldali megvalósítása később,
 * a SPEC-004-ben készült el. A SPEC-003 7.2 táblázata és a `docs:check`
 * lefedettségű `can-transition-step-run-status.spec.ts` teljes 8x8
 * kereszttáblája ugyanebben a lépésben frissült, hogy ne maradjon néma
 * eltérés a dokumentáció és a kód között.**
 */
export function canTransitionStepRunStatus(from: StepRunStatus, to: StepRunStatus): boolean {
  switch (from) {
    case 'pending': {
      return PENDING_TARGETS.has(to);
    }
    case 'running': {
      return RUNNING_TARGETS.has(to);
    }
    case 'waiting_approval': {
      return WAITING_APPROVAL_TARGETS.has(to);
    }
    case 'succeeded':
    case 'failed':
    case 'rejected':
    case 'cancelled':
    case 'interrupted': {
      return false;
    }
  }
}
