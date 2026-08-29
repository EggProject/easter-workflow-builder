import { SetConcurrencyLimitRequestSchema, zodErrorToProtocolErrorBody } from '@easter-workflow-builder/protocol';
import { isProviderId } from '@easter-workflow-builder/provider-capability';
import type { DatabaseContext } from '@easter-workflow-builder/db';
import type { Engine } from '@easter-workflow-builder/engine';
import type { RouteHandler } from '../route-dispatch/route-handler.ts';
import { toConcurrencyLimitView } from './to-concurrency-limit-view.ts';

function notFoundMessage(value: string): string {
  return `A(z) "${value}" providerId nem ismert provider azonosító (not_found).`;
}

/**
 * `PUT /api/settings/concurrency-limits/{providerId}` (SPEC-005 4.2 E
 * táblázat 24. sora). Az útvonal paraméter érvénytelen providerId esetén
 * `not_found`-ot ad.
 */
export function createSetConcurrencyLimitHandler(database: DatabaseContext, engine: Engine): RouteHandler {
  return (context) => {
    const providerId = context.parameters['providerId'] ?? '';
    if (!isProviderId(providerId)) {
      return Promise.resolve({ kind: 'error', message: notFoundMessage(providerId) });
    }

    const parsedBody = SetConcurrencyLimitRequestSchema.safeParse(context.body);
    if (!parsedBody.success) {
      return Promise.resolve({ kind: 'error', message: zodErrorToProtocolErrorBody(parsedBody.error).message });
    }

    const set = database.concurrencyLimits.setLimit(providerId, parsedBody.data.maxConcurrentSteps);
    if (set.kind === 'error') {
      return Promise.resolve(set);
    }

    return Promise.resolve({
      kind: 'ok',
      value: {
        status: 200,
        body: toConcurrencyLimitView(providerId, parsedBody.data.maxConcurrentSteps, engine),
      },
    });
  };
}
