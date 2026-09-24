import type { Outcome } from '@easter-workflow-builder/core';
import type { DatabaseContext } from '../engine-port/database-port.ts';

const OK: Outcome<void> = { kind: 'ok', value: undefined };

/**
 * A megnevezett futások minden `waiting_approval` lépés sorát a hívó által
 * megnevezett záró állapotba viszi (SPEC-003 7.2, `waiting_approval ->
 * cancelled` és `waiting_approval -> interrupted`). Három hívója van, és csak
 * a záró állapotban térnek el:
 *
 * - a felhasználói megszakítás (`cancel-active-run-tree.ts`) és a `fail_run`
 *   hibapolitika (`run-supervisor/advance-run.ts`) `cancelled` állapotot kér
 *   (SPEC-004 8.3, 9. szekció 2. pont);
 * - a szabályos leállás (`shutdown-active-runs.ts`) `interrupted` állapotot,
 *   mert a leállás a rendszer döntése, nem a felhasználóé (SPEC-004 8.3 "az
 *   `interrupted` ... a szabályos leállásnak fenntartott", 10.2 3. pont).
 *
 * Mindhárom ugyanabban a szinkron menetben hívja, amiben a jóváhagyások
 * várakozását lezárja (`ApprovalWaitRegistry.cancelWaitingForRunIds`), tehát
 * egyetlen `await` sem áll a kettő között.
 *
 * **Miért a várakozás lezárásával egy időben, és nem a záró írással.** A
 * döntés (`human-approval-repository.ts` `decideApproval`) a lépés sorának
 * állapotán dönt, compare and set `WHERE` feltétellel. Ha a sor a futás
 * záró írásáig `waiting_approval` maradna, egy futó testvér folyamának
 * kimerülése alatt (SPEC-004 9. szekció 4. pont) érkező döntést a `db`
 * elfogadná: a lépés `succeeded` lenne egy `failed`, `cancelled`, illetve
 * `interrupted` futásban, esemény nélkül, mert a végrehajtó már nem vár
 * (mérve, `docs/research/2026-09-23-megszakitas-leallas-meres.md` 7.
 * szekció). A lezárt sorra érkező döntés `illegal_status_transition` hibával
 * bukik, és a tranzakciója a `human_approval` sor írását is visszagörgeti.
 */
export function closeWaitingApprovalStepRuns(
  runIds: ReadonlySet<string>,
  closedStatus: 'cancelled' | 'interrupted',
  database: DatabaseContext,
): Outcome<void> {
  for (const runId of runIds) {
    const closed = closeWaitingApprovalsOfRun(runId, closedStatus, database);
    if (closed.kind === 'error') {
      return closed;
    }
  }
  return OK;
}

// Egyetlen futás `waiting_approval` sorainak lezárása.
function closeWaitingApprovalsOfRun(
  runId: string,
  closedStatus: 'cancelled' | 'interrupted',
  database: DatabaseContext,
): Outcome<void> {
  const steps = database.stepRuns.listStepRuns(runId);
  if (steps.kind === 'error') {
    return steps;
  }
  for (const step of steps.value) {
    if (step.status !== 'waiting_approval') {
      continue;
    }
    const closed =
      closedStatus === 'cancelled'
        ? database.stepRuns.markStepCancelled(step.id)
        : database.stepRuns.markStepInterrupted(step.id);
    if (closed.kind === 'error') {
      return closed;
    }
  }
  return OK;
}
