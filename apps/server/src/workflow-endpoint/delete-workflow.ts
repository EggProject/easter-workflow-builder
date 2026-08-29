import { DeleteWorkflowRequestSchema, zodErrorToProtocolErrorBody } from '@easter-workflow-builder/protocol';
import type { DatabaseContext } from '@easter-workflow-builder/db';
import type { RouteHandler } from '../route-dispatch/route-handler.ts';

/**
 * `DELETE /api/workflows/{workflowId}` (SPEC-005 4.2 A táblázat 5. sora). A
 * `db` `deleteWorkflow` visszatérése `void`, a válasznak viszont a
 * ténylegesen töröltet kell megneveznie (`DeletionSummary`) - ezért a kezelő
 * a törlés ELŐTT hívja a `summarizeDeletion`-t, és ezt az eredményt adja
 * vissza. A két hívás között nincs `await`, tehát a `better-sqlite3`
 * szinkron, egyszálú kapcsolatán más írás nem ékelődhet közéjük.
 */
export function createDeleteWorkflowHandler(database: DatabaseContext): RouteHandler {
  return (context) => {
    const parsedBody = DeleteWorkflowRequestSchema.safeParse(context.body);
    if (!parsedBody.success) {
      return Promise.resolve({ kind: 'error', message: zodErrorToProtocolErrorBody(parsedBody.error).message });
    }

    const workflowId = context.parameters['workflowId'] ?? '';
    const summary = database.workflows.summarizeDeletion(workflowId);
    if (summary.kind === 'error') {
      return Promise.resolve(summary);
    }

    const deleted = database.workflows.deleteWorkflow({ workflowId, acknowledgeIrreversible: true });
    if (deleted.kind === 'error') {
      return Promise.resolve(deleted);
    }

    return Promise.resolve({ kind: 'ok', value: { status: 200, body: summary.value } });
  };
}
