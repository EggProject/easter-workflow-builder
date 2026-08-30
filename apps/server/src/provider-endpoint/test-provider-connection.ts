import { isProviderId } from '@easter-workflow-builder/provider-capability';
import type { Engine } from '@easter-workflow-builder/engine';
import type { RouteHandler } from '../route-dispatch/route-handler.ts';

function notFoundMessage(value: string): string {
  return `A(z) "${value}" providerId nem ismert provider azonosító (not_found).`;
}

/**
 * `POST /api/providers/{providerId}/connection-test` (SPEC-005 4.2 D
 * táblázat 20. sora). A hívás **a motoron** megy át
 * (`engine.testProviderConnection`). Az útvonal paraméter érvénytelen
 * providerId esetén `not_found`-ot ad (nem `invalid_request`-et, mert ez
 * útvonal paraméter, ugyanaz a besorolás, mint egy ismeretlen erőforrás
 * azonosítója).
 */
export function createTestProviderConnectionHandler(engine: Engine): RouteHandler {
  return async (context) => {
    const providerId = context.parameters['providerId'] ?? '';
    if (!isProviderId(providerId)) {
      return { kind: 'error', message: notFoundMessage(providerId) };
    }

    const tested = await engine.testProviderConnection(providerId);
    if (tested.kind === 'error') {
      return tested;
    }

    return { kind: 'ok', value: { status: 200, body: tested.value } };
  };
}
