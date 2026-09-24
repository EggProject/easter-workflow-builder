import type { PendingApproval } from '@easter-workflow-builder/protocol';

/**
 * Lépés futás azonosító -> a hozzá tartozó függő jóváhagyás `requestedAtMs`
 * mezője (SPEC-008 8. szekció: "hogy mióta vár", `PendingApproval.requestedAtMs`).
 *
 * **Miért nem a `StepRunRecord` valamelyik időbélyege a forrás.** A
 * `requestApproval` a lépés `waiting_approval` állapotba állítása UTÁN hoz
 * létre jóváhagyás sort (`packages/engine` `execute-human-approval.ts`), és a
 * SPEC-005 4.2 C táblázata kifejezetten a `PendingApproval.requestedAtMs`
 * mezőt nevezi meg a "mióta vár" forrásaként, nem a lépés `startedAtMs`
 * mezőjét. A `run-graph` téma ezért ezt a térképet kapja paraméterként, a
 * `PendingApproval` típus importja nélkül (`run-graph/describe-run-node-summary.ts`
 * csak egy `ReadonlyMap<string, number>` térképet fogad, hogy a téma ne
 * függjön az `approval-prompt` témától).
 */
export function pendingApprovalRequestedAtByStepRun(
  approvals: readonly PendingApproval[],
): ReadonlyMap<string, number> {
  return new Map(approvals.map((approval) => [approval.stepRunId, approval.requestedAtMs]));
}
