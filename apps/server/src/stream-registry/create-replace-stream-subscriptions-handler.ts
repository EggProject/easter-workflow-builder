import { SubscriptionRequestSchema, zodErrorToProtocolErrorBody } from '@easter-workflow-builder/protocol';
import type { DatabaseContext } from '@easter-workflow-builder/db';
import type { RouteHandler } from '../route-dispatch/route-handler.ts';
import type { StreamRegistry } from './create-stream-registry.ts';

function notFoundMessage(runId: string): string {
  return `A(z) "${runId}" azonosítójú futás nem található (not_found).`;
}

/**
 * `PUT /api/streams/{streamId}/subscriptions` (SPEC-005 4.2 F táblázat 26.
 * sora): teljes csere, nem hozzáadás. Minden megnevezett `runId`-t
 * ellenőriz (`runs.getRun`), hogy a feliratkozás ne hivatkozzon nem
 * létező futásra; sikeres esetben a `stream-registry` végzi a tényleges
 * cserét és - ha van nyitott kapcsolat erre a `streamId`-re - az újonnan
 * felvett futásokra a pótlást (`stream-connection` `onReplaced`).
 */
export function createReplaceStreamSubscriptionsHandler(
  database: DatabaseContext,
  registry: StreamRegistry,
): RouteHandler {
  return (context) => {
    const parsedBody = SubscriptionRequestSchema.safeParse(context.body);
    if (!parsedBody.success) {
      return Promise.resolve({ kind: 'error', message: zodErrorToProtocolErrorBody(parsedBody.error).message });
    }

    for (const entry of parsedBody.data.runs) {
      const run = database.runs.getRun(entry.runId);
      if (run.kind === 'error') {
        return Promise.resolve({ kind: 'error', message: notFoundMessage(entry.runId) });
      }
    }

    const streamId = context.parameters['streamId'] ?? '';
    registry.replaceSubscriptions(streamId, parsedBody.data.runs);

    return Promise.resolve({
      kind: 'ok',
      value: { status: 200, body: { streamId, subscriptions: registry.getSubscriptions(streamId) } },
    });
  };
}
