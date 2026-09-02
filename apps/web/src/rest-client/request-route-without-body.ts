import type { FetchFunction, Outcome } from '@easter-workflow-builder/core';
import type { RouteId } from '@easter-workflow-builder/protocol';
import { performRouteRequest } from './perform-route-request.ts';
import type { SafeParsableSchema } from './safe-parsable-schema.ts';

export interface RequestRouteWithoutBodyInput<TValue> {
  readonly routeId: RouteId;
  readonly parameters?: Readonly<Record<string, string>>;
  readonly query?: Readonly<Record<string, string>>;
  readonly responseSchema: SafeParsableSchema<TValue>;
  readonly fetchFunction: FetchFunction;
  readonly apiOrigin: string;
  readonly signal?: AbortSignal;
}

/**
 * Törzs nélküli hívás a `ROUTE_TABLE` egy bejegyzésére (SPEC-007 8.1),
 * `GET` és `DELETE` végpontokhoz.
 */
export function requestRouteWithoutBody<TValue>(
  input: Readonly<RequestRouteWithoutBodyInput<TValue>>,
): Promise<Outcome<TValue>> {
  return performRouteRequest({
    routeId: input.routeId,
    parameters: input.parameters ?? {},
    query: input.query,
    hasBody: false,
    body: undefined,
    responseSchema: input.responseSchema,
    fetchFunction: input.fetchFunction,
    apiOrigin: input.apiOrigin,
    signal: input.signal,
  });
}
