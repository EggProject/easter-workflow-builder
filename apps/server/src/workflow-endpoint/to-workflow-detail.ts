import type { WorkflowRecord } from '@easter-workflow-builder/db';
import type { WorkflowDetail } from '@easter-workflow-builder/protocol';

/**
 * A `db` réteg `WorkflowRecord`-ját a drótszintű `WorkflowDetail` alakra
 * képezi (SPEC-005 `workflow` téma): a `createdAtMs`/`updatedAtMs` a `Date`
 * objektumból egész milliszekundum lesz (SPEC-005 4.1 "minden időbélyeg
 * egész milliszekundum"). A `WorkflowSummary` és a `WorkflowDetail` a spec
 * szerint azonos mezőket hordoz (SPEC-005 `workflow-record.ts` doksija),
 * ezért a listázás (`list-workflows.ts`) is ezt a függvényt használja.
 */
export function toWorkflowDetail(record: WorkflowRecord): WorkflowDetail {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    providerId: record.providerId,
    createdAtMs: record.createdAtMs.getTime(),
    updatedAtMs: record.updatedAtMs.getTime(),
  };
}
