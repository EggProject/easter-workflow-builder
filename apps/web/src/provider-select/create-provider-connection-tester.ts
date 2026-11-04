import type { FetchFunction } from '@easter-workflow-builder/core';
import { ConnectionTestResponseSchema } from '@easter-workflow-builder/protocol';
import { requestRouteWithoutBody } from '../rest-client/request-route-without-body.ts';
import type { ProviderConnectionTester } from './provider-connection-tester.ts';

/**
 * A `ProviderConnectionTester` éles megvalósítása: törzs nélküli `POST` a
 * `testProviderConnection` útvonalra (SPEC-005 4.2 D, SPEC-009 3.2).
 */
export function createProviderConnectionTester(
  apiOrigin: string,
  fetchFunction: FetchFunction,
): ProviderConnectionTester {
  return (providerId) =>
    requestRouteWithoutBody({
      routeId: 'testProviderConnection',
      parameters: { providerId },
      responseSchema: ConnectionTestResponseSchema,
      fetchFunction,
      apiOrigin,
    });
}
