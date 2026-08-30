import { CreateWorkflowRequestSchema, zodErrorToProtocolErrorBody } from '@easter-workflow-builder/protocol';
import { isProviderId } from '@easter-workflow-builder/provider-capability';
import type { DatabaseContext } from '@easter-workflow-builder/db';
import type { RouteHandler } from '../route-dispatch/route-handler.ts';
import { toWorkflowDetail } from './to-workflow-detail.ts';

function invalidProviderIdMessage(value: string): string {
  return `A(z) "${value}" providerId nem ismert provider azonosító (invalid_request).`;
}

/**
 * `POST /api/workflows` (SPEC-005 4.2 A táblázat 2. sora). A `providerId`
 * wire alakja sima szöveg (a `protocol` L1 réteg nem importálhatja a
 * `provider-capability` `ProviderId` unióját, SPEC-005 F-23); ezen a rétegen
 * (`apps/server`, L6) viszont igen, ezért a szűkítést itt, a `db` hívása
 * előtt végezzük el.
 */
export function createCreateWorkflowHandler(database: DatabaseContext): RouteHandler {
  return (context) => {
    const parsedBody = CreateWorkflowRequestSchema.safeParse(context.body);
    if (!parsedBody.success) {
      return Promise.resolve({ kind: 'error', message: zodErrorToProtocolErrorBody(parsedBody.error).message });
    }

    const { name, description, providerId } = parsedBody.data;
    if (providerId !== null && !isProviderId(providerId)) {
      return Promise.resolve({ kind: 'error', message: invalidProviderIdMessage(providerId) });
    }

    const created = database.workflows.createWorkflow({ name, description, providerId });
    if (created.kind === 'error') {
      return Promise.resolve(created);
    }

    return Promise.resolve({ kind: 'ok', value: { status: 200, body: toWorkflowDetail(created.value) } });
  };
}
