import type { DatabaseContext } from '@easter-workflow-builder/db';
import type { RouteHandler } from '../route-dispatch/route-handler.ts';

/**
 * `GET /api/workflows/{workflowId}/deletion-summary` (SPEC-005 4.2 A
 * táblázat 6. sora): előzetes, nem törlő lekérdezés - ugyanaz a
 * `summarizeDeletion` hívás, mint a `delete-workflow.ts`-ben, csak itt
 * nincs utána tényleges törlés.
 */
export function createSummarizeWorkflowDeletionHandler(database: DatabaseContext): RouteHandler {
  return (context) => {
    const summary = database.workflows.summarizeDeletion(context.parameters['workflowId'] ?? '');
    if (summary.kind === 'error') {
      return Promise.resolve(summary);
    }
    return Promise.resolve({ kind: 'ok', value: { status: 200, body: summary.value } });
  };
}
