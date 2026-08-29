import type { WorkflowRunRecord } from '@easter-workflow-builder/db';
import type { RunSummary } from '@easter-workflow-builder/protocol';

/**
 * A `db` réteg `WorkflowRunRecord`-ját a drótszintű `RunSummary` alakra
 * képezi (SPEC-005 `run` téma): a `Date` mezők egész milliszekundummá
 * alakulnak (SPEC-005 4.1). Két kezelő is használja (`list-runs.ts`,
 * `get-run.ts` a saját `RunDetail` képzésén belül nem, mert ott több mező
 * kell), ezért saját fájlt kapott, ugyanaz a minta, mint a
 * `workflow-endpoint/to-workflow-detail.ts`.
 */
export function toRunSummary(record: WorkflowRunRecord): RunSummary {
  return {
    id: record.id,
    workflowId: record.workflowId,
    status: record.status,
    providerId: record.providerId,
    createdAtMs: record.createdAtMs.getTime(),
    // eslint-disable-next-line unicorn/no-null -- a RunSummary.startedAtMs/finishedAtMs mezője valódi Date | null
    startedAtMs: record.startedAtMs === null ? null : record.startedAtMs.getTime(),
    // eslint-disable-next-line unicorn/no-null -- lásd fent
    finishedAtMs: record.finishedAtMs === null ? null : record.finishedAtMs.getTime(),
    errorKind: record.errorKind,
    errorMessage: record.errorMessage,
  };
}
