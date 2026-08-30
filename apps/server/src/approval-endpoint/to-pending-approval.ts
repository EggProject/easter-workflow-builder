import type { HumanApprovalRecord } from '@easter-workflow-builder/db';
import type { PendingApproval } from '@easter-workflow-builder/protocol';

/**
 * A `db` réteg `HumanApprovalRecord`-ja a drótszintű `PendingApproval`
 * alakra (SPEC-005 4.2 C táblázat 17. és 18. sora): a `Date` mezők egész
 * milliszekundum lesznek. Két kezelő is használja
 * (`list-pending-approvals.ts`, `decide-approval.ts`), ezért saját fájlt
 * kapott.
 */
export function toPendingApproval(record: HumanApprovalRecord): PendingApproval {
  return {
    id: record.id,
    runId: record.runId,
    stepRunId: record.stepRunId,
    title: record.title,
    body: record.body,
    payload: record.payload,
    decision: record.decision,
    requestedAtMs: record.requestedAtMs.getTime(),
    // eslint-disable-next-line unicorn/no-null -- a PendingApproval.decidedAtMs mezője valódi Date | null
    decidedAtMs: record.decidedAtMs === null ? null : record.decidedAtMs.getTime(),
  };
}
