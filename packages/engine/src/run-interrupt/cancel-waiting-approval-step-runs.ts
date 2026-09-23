import type { Outcome } from '@easter-workflow-builder/core';
import type { DatabaseContext } from '../engine-port/database-port.ts';

const OK: Outcome<void> = { kind: 'ok', value: undefined };

/**
 * A megnevezett futások minden `waiting_approval` lépés sorát `cancelled`
 * állapotba viszi (SPEC-003 7.2, `waiting_approval -> cancelled`). A
 * felhasználói megszakítás (`interrupt-run.ts`) és a `fail_run` hibapolitika
 * (`run-supervisor/advance-run.ts`) hívja, ugyanabban a szinkron menetben,
 * amiben a jóváhagyások várakozását lezárja
 * (`ApprovalWaitRegistry.cancelWaitingForRunIds`), tehát egyetlen `await`
 * sem áll a kettő között.
 *
 * **Miért a várakozás lezárásával egy időben, és nem a záró írással.** A
 * döntés (`human-approval-repository.ts` `decideApproval`) a lépés sorának
 * állapotán dönt, compare and set `WHERE` feltétellel. Ha a sor a futás
 * záró írásáig `waiting_approval` maradna, egy futó testvér folyamának
 * kimerülése alatt (SPEC-004 9. szekció 4. pont) érkező döntést a `db`
 * elfogadná: a lépés `succeeded` lenne egy `failed`, illetve `cancelled`
 * futásban, esemény nélkül, mert a végrehajtó már nem vár (mérve,
 * `docs/research/2026-09-23-megszakitas-leallas-meres.md` 7. szekció). A
 * `cancelled` sorra érkező döntés `illegal_status_transition` hibával bukik,
 * és a tranzakciója a `human_approval` sor írását is visszagörgeti.
 *
 * A szabályos leállás nem hívja: ott a záró állapot `interrupted`, amit a
 * `recoverInterruptedRuns` ír (SPEC-004 10.2).
 */
export function cancelWaitingApprovalStepRuns(runIds: ReadonlySet<string>, database: DatabaseContext): Outcome<void> {
  for (const runId of runIds) {
    const closed = cancelWaitingApprovalsOfRun(runId, database);
    if (closed.kind === 'error') {
      return closed;
    }
  }
  return OK;
}

// Egyetlen futás `waiting_approval` sorainak lezárása.
function cancelWaitingApprovalsOfRun(runId: string, database: DatabaseContext): Outcome<void> {
  const steps = database.stepRuns.listStepRuns(runId);
  if (steps.kind === 'error') {
    return steps;
  }
  for (const step of steps.value) {
    if (step.status !== 'waiting_approval') {
      continue;
    }
    const cancelled = database.stepRuns.markStepCancelled(step.id);
    if (cancelled.kind === 'error') {
      return cancelled;
    }
  }
  return OK;
}
