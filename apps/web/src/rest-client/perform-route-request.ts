import type { FetchFunction, Outcome } from '@easter-workflow-builder/core';
import { buildRoutePath, ProtocolErrorBodySchema, ROUTE_TABLE, type RouteId } from '@easter-workflow-builder/protocol';
import { protocolErrorMessage } from '../protocol-error-message/protocol-error-message.ts';
import type { SafeParsableSchema } from './safe-parsable-schema.ts';

/**
 * A `requestRoute` és a `requestRouteWithoutBody` közös törzse (SPEC-007
 * 8.1, 8.2, 8.3). Nem exportált: a két nyilvános belépési pont csak a
 * `hasBody` mezőben tér el, hogy a "kimenő oldalon nem validálunk" elv
 * mellett se kelljen a hívónak `body: undefined` mezőt írnia egy GET
 * hívásnál (SPEC-007 8.2).
 */
export interface PerformRouteRequestInput<TValue> {
  readonly routeId: RouteId;
  readonly parameters: Readonly<Record<string, string>>;
  readonly query: Readonly<Record<string, string>> | undefined;
  readonly hasBody: boolean;
  readonly body: unknown;
  readonly responseSchema: SafeParsableSchema<TValue>;
  readonly fetchFunction: FetchFunction;
  readonly apiOrigin: string;
  readonly signal: AbortSignal | undefined;
}

function buildRequestUrl(apiOrigin: string, path: string, query: Readonly<Record<string, string>> | undefined): string {
  const url = new URL(path, apiOrigin);
  const queryEntries = Object.entries(query ?? {});
  for (const [key, value] of queryEntries) {
    url.searchParams.set(key, value);
  }
  return url.href;
}

/**
 * Nem dobó JSON dekódolás. A `Response#json()` dobna hibás vagy üres
 * törzsre; ez a réteg helyette `Outcome` hibaágat ad (SPEC-007 8.3 "hibás
 * JSON" ága). 204 válaszra a törzs `undefined`: a `responseSchema` ezt
 * kapja, tehát a "nincs érték" eset ugyanazon a validáló úton megy át, mint
 * bármely más válasz (`as` kényszerítés nélkül).
 */
async function decodeResponseBody(response: Response): Promise<Outcome<unknown>> {
  if (response.status === 204) {
    return { kind: 'ok', value: undefined };
  }
  const text = await response.text();
  try {
    const parsedValue: unknown = JSON.parse(text);
    return { kind: 'ok', value: parsedValue };
  } catch {
    return { kind: 'error', message: 'A szerver nem érvényes JSON választ adott.' };
  }
}

async function buildProtocolErrorOutcome<TValue>(response: Response): Promise<Outcome<TValue>> {
  const decoded = await decodeResponseBody(response);
  const parsed = decoded.kind === 'ok' ? ProtocolErrorBodySchema.safeParse(decoded.value) : undefined;
  if (!parsed?.success) {
    return { kind: 'error', message: `A szerver hibás választ adott (HTTP ${String(response.status)}).` };
  }
  return { kind: 'error', message: `${protocolErrorMessage(parsed.data.code)}: ${parsed.data.message}` };
}

export async function performRouteRequest<TValue>(
  input: Readonly<PerformRouteRequestInput<TValue>>,
): Promise<Outcome<TValue>> {
  const { routeId, parameters, query, hasBody, body, responseSchema, fetchFunction, apiOrigin, signal } = input;

  const pathOutcome = buildRoutePath(routeId, parameters);
  if (pathOutcome.kind === 'error') {
    return { kind: 'error', message: pathOutcome.message };
  }

  const url = buildRequestUrl(apiOrigin, pathOutcome.value, query);
  const { method } = ROUTE_TABLE[routeId];

  let response: Response;
  try {
    response = await fetchFunction(url, {
      method,
      // eslint-disable-next-line unicorn/no-null -- a DOM `RequestInit#signal` típusa `AbortSignal | null`, nem fogad `undefined`-et.
      signal: signal ?? null,
      headers: hasBody ? { 'Content-Type': 'application/json' } : {},
      // eslint-disable-next-line unicorn/no-null -- a DOM `RequestInit#body` típusa `BodyInit | null`, nem fogad `undefined`-et.
      body: hasBody ? JSON.stringify(body) : null,
    });
  } catch {
    return { kind: 'error', message: 'A szerver nem érhető el.' };
  }

  if (!response.ok) {
    return buildProtocolErrorOutcome<TValue>(response);
  }

  const decoded = await decodeResponseBody(response);
  if (decoded.kind === 'error') {
    return decoded;
  }

  const parsed = responseSchema.safeParse(decoded.value);
  if (!parsed.success) {
    const paths = parsed.error.issues.map((issue) => (issue.path.length === 0 ? '(gyökér)' : issue.path.join('.')));
    return { kind: 'error', message: `A szerver váratlan választ adott (${paths.join(', ')}).` };
  }
  return { kind: 'ok', value: parsed.data };
}
