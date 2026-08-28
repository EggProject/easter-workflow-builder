import type { RunStatus } from './run-status.ts';

const PENDING_TARGETS: ReadonlySet<RunStatus> = new Set(['running', 'cancelled', 'interrupted']);
const RUNNING_TARGETS: ReadonlySet<RunStatus> = new Set(['succeeded', 'failed', 'cancelled', 'interrupted']);

/**
 * A futás állapotgép engedélyezett átmenetei (SPEC-003 7.1 táblázat, 22.
 * kritérium). A `succeeded`, `failed`, `cancelled` és `interrupted`
 * terminális: nincs belőlük kimenő átmenet, ezért egy közös `case` ággal
 * térnek vissza. A kimerítő `switch` a `from` mind a hat ágát lefedi, a
 * fordító `switch-exhaustiveness-check` szabálya hibát ad, ha a `RunStatus`
 * unió bővül, és az új ág innen hiányzik.
 */
export function canTransitionRunStatus(from: RunStatus, to: RunStatus): boolean {
  switch (from) {
    case 'pending': {
      return PENDING_TARGETS.has(to);
    }
    case 'running': {
      return RUNNING_TARGETS.has(to);
    }
    case 'succeeded':
    case 'failed':
    case 'cancelled':
    case 'interrupted': {
      return false;
    }
  }
}
