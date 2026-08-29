import type { DecideApprovalInput } from '@easter-workflow-builder/db';

/**
 * Az `Engine.decideApproval` bemenete (SPEC-004 3.1 `Engine` felület,
 * PLAN-005 T-005-28). Szó szerint a `db` csomag `DecideApprovalInput` alakja
 * (`stepRunId`, `decision`): a motor felülete nem tesz hozzá és nem vesz el
 * mezőt, mert a `decideApproval` motor művelet a bemenetet változtatás nélkül
 * adja tovább a `database.approvals.decideApproval(...)` hívásnak
 * (`create-engine.ts`).
 */
export type ApprovalDecisionInput = DecideApprovalInput;
