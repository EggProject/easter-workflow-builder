import type { DatabaseContext, WorkflowRunRecord } from '@easter-workflow-builder/db';
import type { RouteHandler } from '../route-dispatch/route-handler.ts';

/**
 * A `db` réteg `WorkflowRunRecord`-ja a drótszintű `RunDetail` alakra
 * (SPEC-005 4.2 B táblázat 11. sora): a két alak mezőnként egyezik, csak a
 * `Date` mezők lesznek egész milliszekundum.
 */
function toRunDetail(record: WorkflowRunRecord) {
  return {
    id: record.id,
    workflowId: record.workflowId,
    status: record.status,
    input: record.input,
    providerId: record.providerId,
    rootRunId: record.rootRunId,
    depth: record.depth,
    workflowAncestry: record.workflowAncestry,
    graphSnapshotHash: record.graphSnapshotHash,
    persistedStreamDeltas: record.persistedStreamDeltas,
    restartedFromRunId: record.restartedFromRunId,
    createdAtMs: record.createdAtMs.getTime(),
    // eslint-disable-next-line unicorn/no-null -- a RunDetail.startedAtMs/finishedAtMs mezője valódi Date | null
    startedAtMs: record.startedAtMs === null ? null : record.startedAtMs.getTime(),
    // eslint-disable-next-line unicorn/no-null -- lásd fent
    finishedAtMs: record.finishedAtMs === null ? null : record.finishedAtMs.getTime(),
    errorKind: record.errorKind,
    errorMessage: record.errorMessage,
  };
}

/**
`GET /api/runs/{runId}` (SPEC-005 4.2 B táblázat 11. sora).
*/
export function createGetRunHandler(database: DatabaseContext): RouteHandler {
  return (context) => {
    const found = database.runs.getRun(context.parameters['runId'] ?? '');
    if (found.kind === 'error') {
      return Promise.resolve(found);
    }
    return Promise.resolve({ kind: 'ok', value: { status: 200, body: toRunDetail(found.value) } });
  };
}
