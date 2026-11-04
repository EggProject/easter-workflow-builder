import type { FetchFunction } from '@easter-workflow-builder/core';
import type { ZipBodyRouteId } from '@easter-workflow-builder/protocol';
import { performRouteRequest } from './perform-route-request.ts';
import type { RouteOutcome } from './route-outcome.ts';
import type { SafeParsableSchema } from './safe-parsable-schema.ts';

export interface RequestRouteWithZipBodyInput<TValue> {
  readonly routeId: ZipBodyRouteId;
  readonly parameters: Readonly<Record<string, string>>;
  /**
   * A fájl bájtjai, ahogy a böngésző adja (`File` is `Blob`): a törzs nyers
   * ZIP csomag, nem JSON.
   */
  readonly body: Blob;
  readonly responseSchema: SafeParsableSchema<TValue>;
  readonly fetchFunction: FetchFunction;
  readonly apiOrigin: string;
  readonly signal?: AbortSignal;
}

/**
 * Nyers ZIP törzsű hívás a `ROUTE_TABLE` `requestBody: 'application/zip'`
 * jelölésű végpontjára (SPEC-009 5.1, O-36; ma a `uploadSkill`). A
 * `Content-Type` `application/zip`, a törzs a fájl bájtjai. A `routeId`
 * típusa a `ZipBodyRouteId`, tehát JSON végpont ide nem fordul le.
 */
export function requestRouteWithZipBody<TValue>(
  input: Readonly<RequestRouteWithZipBodyInput<TValue>>,
): Promise<RouteOutcome<TValue>> {
  return performRouteRequest({
    routeId: input.routeId,
    parameters: input.parameters,
    query: undefined,
    hasBody: true,
    body: undefined,
    zipBody: input.body,
    responseSchema: input.responseSchema,
    fetchFunction: input.fetchFunction,
    apiOrigin: input.apiOrigin,
    signal: input.signal,
  });
}
