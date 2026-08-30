import { ListRunsQuerySchema, zodErrorToProtocolErrorBody } from '@easter-workflow-builder/protocol';
import type { DatabaseContext } from '@easter-workflow-builder/db';
import type { RouteHandler } from '../route-dispatch/route-handler.ts';
import { toRunSummary } from './to-run-summary.ts';

function parseQuery(query: URLSearchParams): Readonly<Record<string, unknown>> {
  const limit = query.get('limit');
  const workflowId = query.get('workflowId');
  return {
    ...(limit !== null && { limit: Number(limit) }),
    ...(workflowId !== null && { workflowId }),
  };
}

/**
 * `GET /api/runs` (SPEC-005 4.2 B táblázat 10. sora). A `workflowId` query
 * paraméter elhagyható: ha hiányzik, a teljes lista jön (`runs.listRuns`),
 * ha megvan, a szűkített (`runs.listRunsForWorkflow`).
 */
export function createListRunsHandler(database: DatabaseContext): RouteHandler {
  return (context) => {
    const parsedQuery = ListRunsQuerySchema.safeParse(parseQuery(context.query));
    if (!parsedQuery.success) {
      return Promise.resolve({ kind: 'error', message: zodErrorToProtocolErrorBody(parsedQuery.error).message });
    }

    const { limit, workflowId } = parsedQuery.data;
    const listed = workflowId === undefined ? database.runs.listRuns() : database.runs.listRunsForWorkflow(workflowId);
    if (listed.kind === 'error') {
      return Promise.resolve(listed);
    }

    return Promise.resolve({
      kind: 'ok',
      value: { status: 200, body: listed.value.slice(0, limit).map((record) => toRunSummary(record)) },
    });
  };
}
