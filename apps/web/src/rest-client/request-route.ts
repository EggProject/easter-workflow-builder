import type { FetchFunction } from '@easter-workflow-builder/core';
import type { RouteId, ZipBodyRouteId } from '@easter-workflow-builder/protocol';
import { performRouteRequest } from './perform-route-request.ts';
import type { RouteOutcome } from './route-outcome.ts';
import type { SafeParsableSchema } from './safe-parsable-schema.ts';

export interface RequestRouteInput<TValue> {
  /**
   * JSON (vagy törzs nélküli) végpont: a nyers ZIP törzsű végpont a
   * `requestRouteWithZipBody` dolga.
   */
  readonly routeId: Exclude<RouteId, ZipBodyRouteId>;
  readonly parameters?: Readonly<Record<string, string>>;
  readonly query?: Readonly<Record<string, string>>;
  readonly body: unknown;
  readonly responseSchema: SafeParsableSchema<TValue>;
  readonly fetchFunction: FetchFunction;
  readonly apiOrigin: string;
  readonly signal?: AbortSignal;
}

/**
 * Törzzsel járó hívás a `ROUTE_TABLE` egy bejegyzésére (SPEC-007 8.1),
 * `POST`, `PUT` és `PATCH` végpontokhoz. A `fetchFunction` befecskendezett
 * port (8.3): valós hálózat nélkül tesztelhető minden hibaág.
 */
export function requestRoute<TValue>(input: Readonly<RequestRouteInput<TValue>>): Promise<RouteOutcome<TValue>> {
  return performRouteRequest({
    routeId: input.routeId,
    parameters: input.parameters ?? {},
    query: input.query,
    hasBody: true,
    body: input.body,
    responseSchema: input.responseSchema,
    fetchFunction: input.fetchFunction,
    apiOrigin: input.apiOrigin,
    signal: input.signal,
  });
}
