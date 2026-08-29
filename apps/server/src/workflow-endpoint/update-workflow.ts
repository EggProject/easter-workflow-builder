import { UpdateWorkflowRequestSchema, zodErrorToProtocolErrorBody, type UpdateWorkflowRequest } from '@easter-workflow-builder/protocol';
import { isProviderId } from '@easter-workflow-builder/provider-capability';
import type { DatabaseContext, WorkflowRecord } from '@easter-workflow-builder/db';
import type { Outcome } from '@easter-workflow-builder/core';
import type { RouteHandler, RouteHandlerResult } from '../route-dispatch/route-handler.ts';
import { toWorkflowDetail } from './to-workflow-detail.ts';

function invalidProviderIdMessage(value: string): string {
  return `A(z) "${value}" providerId nem ismert provider azonosító (invalid_request).`;
}

/**
 * A kezelő szinkron, tesztelhető magja - a `database` minden hívása
 * `better-sqlite3` alapon szinkron, tehát nincs mit `await`-elni
 * (`@typescript-eslint/require-await`), a `Promise` burkolást a
 * `createUpdateWorkflowHandler` végzi, egyetlen ponton.
 */
function handleUpdateWorkflow(
  existing: WorkflowRecord,
  patch: UpdateWorkflowRequest,
  database: DatabaseContext,
): Outcome<RouteHandlerResult> {
  const providerId = patch.providerId === undefined ? existing.providerId : patch.providerId;
  if (providerId !== null && !isProviderId(providerId)) {
    return { kind: 'error', message: invalidProviderIdMessage(providerId) };
  }

  const updated = database.workflows.updateWorkflow(existing.id, {
    name: patch.name ?? existing.name,
    description: patch.description === undefined ? existing.description : patch.description,
    providerId,
  });
  if (updated.kind === 'error') {
    return updated;
  }

  return { kind: 'ok', value: { status: 200, body: toWorkflowDetail(updated.value) } };
}

/**
 * `PATCH /api/workflows/{workflowId}` (SPEC-005 4.2 A táblázat 4. sora):
 * részleges frissítés, minden mező elhagyható. A `db` `updateWorkflow`
 * viszont a TELJES rekordot várja (nincs mezőnkénti frissítés a repository
 * szintjén), ezért a kezelő először beolvassa a meglévő workflow-t, és a
 * kérésben megadott mezőket rá fésüli - az elhagyott mező (`undefined`) a
 * meglévő értéken marad, a kifejezetten `null`-ra állított mező (leírás,
 * providerId) érvényesül.
 */
export function createUpdateWorkflowHandler(database: DatabaseContext): RouteHandler {
  return (context) => {
    const parsedBody = UpdateWorkflowRequestSchema.safeParse(context.body);
    if (!parsedBody.success) {
      return Promise.resolve({ kind: 'error', message: zodErrorToProtocolErrorBody(parsedBody.error).message });
    }

    const existing = database.workflows.getWorkflow(context.parameters['workflowId'] ?? '');
    if (existing.kind === 'error') {
      return Promise.resolve(existing);
    }

    return Promise.resolve(handleUpdateWorkflow(existing.value, parsedBody.data, database));
  };
}
