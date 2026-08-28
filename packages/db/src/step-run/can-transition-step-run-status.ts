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
