import { isProviderId } from '@easter-workflow-builder/provider-capability';
import type { DatabaseContext } from '@easter-workflow-builder/db';
import type { RouteHandler } from '../route-dispatch/route-handler.ts';

function notFoundMessage(value: string): string {
  return `A(z) "${value}" providerId nem ismert provider azonosító (not_found).`;
}

/**
 * `DELETE /api/settings/concurrency-limits/{providerId}` (SPEC-005 4.2 E
 * táblázat 25. sora). Sikeres törlésre `204`, üres törzs
 * (`body: undefined`) - a `http-server` réteg ekkor `Content-Type` fejléc
 * nélkül zár (`create-http-server.ts` `writeJson`).
 */
export function createClearConcurrencyLimitHandler(database: DatabaseContext): RouteHandler {
  return (context) => {
    const providerId = context.parameters['providerId'] ?? '';
    if (!isProviderId(providerId)) {
      return Promise.resolve({ kind: 'error', message: notFoundMessage(providerId) });
    }

    const cleared = database.concurrencyLimits.clearLimit(providerId);
    if (cleared.kind === 'error') {
      return Promise.resolve(cleared);
    }

    return Promise.resolve({ kind: 'ok', value: { status: 204, body: undefined } });
  };
}
