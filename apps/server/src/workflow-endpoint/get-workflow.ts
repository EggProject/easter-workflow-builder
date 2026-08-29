import type { DatabaseContext } from '@easter-workflow-builder/db';
import type { RouteHandler } from '../route-dispatch/route-handler.ts';
import { toWorkflowDetail } from './to-workflow-detail.ts';

/**
 * `GET /api/workflows/{workflowId}` (SPEC-005 4.2 A táblázat 3. sora). A
 * `workflowId` a `route-dispatch` illesztőből jön, sima szövegként. A
 * `database` minden hívása szinkron, ezért a `Promise.resolve` a
 * kifejezetten wrapoló egyetlen pont, nem `async` függvény
 * (`@typescript-eslint/require-await`).
 */
export function createGetWorkflowHandler(database: DatabaseContext): RouteHandler {
  return (context) => {
    const found = database.workflows.getWorkflow(context.parameters['workflowId'] ?? '');
    if (found.kind === 'error') {
      return Promise.resolve(found);
    }
    return Promise.resolve({ kind: 'ok', value: { status: 200, body: toWorkflowDetail(found.value) } });
  };
}
