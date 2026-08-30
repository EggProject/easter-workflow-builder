import type { DatabaseContext } from '@easter-workflow-builder/db';
import type { RouteHandler } from '../route-dispatch/route-handler.ts';
import { toWorkflowGraphDocument } from './to-workflow-graph-document.ts';

/**
 * `GET /api/workflows/{workflowId}/graph` (SPEC-005 4.2 A táblázat 7. sora).
 * A `db` `readGraph` nem ad `not_found` hibát ismeretlen `workflowId`-ra
 * (üres node/él listát ad helyette, mert nincs FK ellenőrzés SELECT-en), ezért
 * a kezelő előbb `getWorkflow`-val ellenőrzi a workflow létezését.
 */
export function createReadWorkflowGraphHandler(database: DatabaseContext): RouteHandler {
  return (context) => {
    const workflowId = context.parameters['workflowId'] ?? '';
    const existing = database.workflows.getWorkflow(workflowId);
    if (existing.kind === 'error') {
      return Promise.resolve(existing);
    }

    const graph = database.workflows.readGraph(workflowId);
    if (graph.kind === 'error') {
      return Promise.resolve(graph);
    }

    return Promise.resolve({ kind: 'ok', value: { status: 200, body: toWorkflowGraphDocument(graph.value) } });
  };
}
