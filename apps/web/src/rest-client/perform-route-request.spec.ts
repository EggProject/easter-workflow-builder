import type { FetchFunction } from '@easter-workflow-builder/core';
import { describe, expect, it, vi } from 'vitest';
import { performRouteRequest } from './perform-route-request.ts';
import type { SafeParsableSchema, SafeParseOutcome } from './safe-parsable-schema.ts';

const API_ORIGIN = 'https://api.example.test';

interface DemoValue {
  readonly name: string;
}

function isDemoValue(input: unknown): input is DemoValue {
  return typeof input === 'object' && input !== null && 'name' in input && typeof input.name === 'string';
}

const demoValueSchema: SafeParsableSchema<DemoValue> = {
  safeParse: (input: unknown): SafeParseOutcome<DemoValue> =>
    isDemoValue(input) ? { success: true, data: input } : { success: false, error: { issues: [{ path: ['name'] }] } },
};

const undefinedSchema: SafeParsableSchema<undefined> = {
  safeParse: (input: unknown): SafeParseOutcome<undefined> =>
    input === undefined ? { success: true, data: undefined } : { success: false, error: { issues: [] } },
};

function jsonResponse(status: number, body: unknown): Response {
  return Response.json(body, { status });
}

const rejectingFetchFunction: FetchFunction = () => Promise.reject(new Error('kapcsolat megszakadt'));

const abortingFetchFunction: FetchFunction = () => Promise.reject(new DOMException('lemondva', 'AbortError'));

const notFoundProtocolErrorFetchFunction: FetchFunction = () =>
  Promise.resolve(jsonResponse(404, { code: 'not_found', message: 'workflow-1 nem található' }));

const nonJsonErrorFetchFunction: FetchFunction = () => Promise.resolve(new Response('nem json', { status: 500 }));

const noContentFetchFunction: FetchFunction = () =>
  // eslint-disable-next-line unicorn/no-null -- a DOM `Response` konstruktor törzse `BodyInit | null`, egy üres 204 választ csak `null` törzzsel lehet leírni.
  Promise.resolve(new Response(null, { status: 204 }));

const invalidJsonFetchFunction: FetchFunction = () => Promise.resolve(new Response('{nem json', { status: 200 }));

const mismatchedSchemaFetchFunction: FetchFunction = () => Promise.resolve(jsonResponse(200, { nemLetezoMezo: 1 }));

const emptyObjectFetchFunction: FetchFunction = () => Promise.resolve(jsonResponse(200, {}));

describe('performRouteRequest', () => {
  it('útvonal építési hiba esetén Outcome hibaágat ad, fetch hívás nélkül', async () => {
    const fetchFunction = vi.fn<FetchFunction>();

    const outcome = await performRouteRequest({
      routeId: 'getWorkflow',
      parameters: {},
      query: undefined,
      hasBody: false,
      body: undefined,
      responseSchema: demoValueSchema,
      fetchFunction,
      apiOrigin: API_ORIGIN,
      signal: undefined,
    });

    expect(outcome.kind).toBe('error');
    expect(fetchFunction).not.toHaveBeenCalled();
  });

  it('hálózati hiba esetén Outcome hibaágat ad', async () => {
    const outcome = await performRouteRequest({
      routeId: 'listWorkflows',
      parameters: {},
      query: { limit: '25' },
      hasBody: false,
      body: undefined,
      responseSchema: demoValueSchema,
      fetchFunction: rejectingFetchFunction,
      apiOrigin: API_ORIGIN,
      signal: undefined,
    });

    expect(outcome).toEqual({ kind: 'error', message: 'A szerver nem érhető el.' });
  });

  it('lemondás (AbortError) esetén ugyanazon az ágon Outcome hibaágat ad', async () => {
    const outcome = await performRouteRequest({
      routeId: 'listWorkflows',
      parameters: {},
      query: { limit: '25' },
      hasBody: false,
      body: undefined,
      responseSchema: demoValueSchema,
      fetchFunction: abortingFetchFunction,
      apiOrigin: API_ORIGIN,
      signal: undefined,
    });

    expect(outcome.kind).toBe('error');
  });

  it('protokoll hiba esetén a kód szerinti mondatot és a szerver üzenetét adja', async () => {
    const outcome = await performRouteRequest({
      routeId: 'getWorkflow',
      parameters: { workflowId: 'workflow-1' },
      query: undefined,
      hasBody: false,
      body: undefined,
      responseSchema: demoValueSchema,
      fetchFunction: notFoundProtocolErrorFetchFunction,
      apiOrigin: API_ORIGIN,
      signal: undefined,
    });

    expect(outcome).toEqual({
      kind: 'error',
      message: 'A keresett elem nem létezik, esetleg időközben törölték.: workflow-1 nem található',
    });
  });

  it('nem 2xx válaszra, ha a törzs nem illeszkedik a ProtocolErrorBodySchema-ra, HTTP státuszos üzenetet ad', async () => {
    const outcome = await performRouteRequest({
      routeId: 'listWorkflows',
      parameters: {},
      query: undefined,
      hasBody: false,
      body: undefined,
      responseSchema: demoValueSchema,
      fetchFunction: nonJsonErrorFetchFunction,
      apiOrigin: API_ORIGIN,
      signal: undefined,
    });

    expect(outcome).toEqual({ kind: 'error', message: 'A szerver hibás választ adott (HTTP 500).' });
  });

  it('204 válaszra a séma undefined bemenettel fut, és a séma szerinti értéket adja', async () => {
    const outcome = await performRouteRequest({
      routeId: 'deleteWorkflow',
      parameters: { workflowId: 'workflow-1' },
      query: undefined,
      hasBody: false,
      body: undefined,
      responseSchema: undefinedSchema,
      fetchFunction: noContentFetchFunction,
      apiOrigin: API_ORIGIN,
      signal: undefined,
    });

    expect(outcome).toEqual({ kind: 'ok', value: undefined });
  });

  it('200 válaszra, ha a törzs nem érvényes JSON, Outcome hibaágat ad', async () => {
    const outcome = await performRouteRequest({
      routeId: 'listWorkflows',
      parameters: {},
      query: undefined,
      hasBody: false,
      body: undefined,
      responseSchema: demoValueSchema,
      fetchFunction: invalidJsonFetchFunction,
      apiOrigin: API_ORIGIN,
      signal: undefined,
    });

    expect(outcome).toEqual({ kind: 'error', message: 'A szerver nem érvényes JSON választ adott.' });
  });

  it('200 válaszra, ha a törzs nem illeszkedik a responseSchema-ra, Outcome hibaágat ad a mezőúttal', async () => {
    const outcome = await performRouteRequest({
      routeId: 'listWorkflows',
      parameters: {},
      query: undefined,
      hasBody: false,
      body: undefined,
      responseSchema: demoValueSchema,
      fetchFunction: mismatchedSchemaFetchFunction,
      apiOrigin: API_ORIGIN,
      signal: undefined,
    });

    expect(outcome).toEqual({ kind: 'error', message: 'A szerver váratlan választ adott (name).' });
  });

  it('a mezőút hiányában "(gyökér)" jelölést ad', async () => {
    const invalidRootSchema: SafeParsableSchema<DemoValue> = {
      safeParse: (): SafeParseOutcome<DemoValue> => ({ success: false, error: { issues: [{ path: [] }] } }),
    };

    const outcome = await performRouteRequest({
      routeId: 'listWorkflows',
      parameters: {},
      query: undefined,
      hasBody: false,
      body: undefined,
      responseSchema: invalidRootSchema,
      fetchFunction: emptyObjectFetchFunction,
      apiOrigin: API_ORIGIN,
      signal: undefined,
    });

    expect(outcome).toEqual({ kind: 'error', message: 'A szerver váratlan választ adott ((gyökér)).' });
  });

  it('sikeres 200 válaszra a séma szerinti típusos értéket adja, a query paraméterekkel együtt hívva', async () => {
    let capturedUrl = '';
    const fetchFunction: FetchFunction = (input) => {
      capturedUrl = input;
      return Promise.resolve(jsonResponse(200, { name: 'Alfa' }));
    };

    const outcome = await performRouteRequest({
      routeId: 'listWorkflows',
      parameters: {},
      query: { limit: '25' },
      hasBody: false,
      body: undefined,
      responseSchema: demoValueSchema,
      fetchFunction,
      apiOrigin: API_ORIGIN,
      signal: undefined,
    });

    expect(outcome).toEqual({ kind: 'ok', value: { name: 'Alfa' } });
    expect(capturedUrl).toBe(`${API_ORIGIN}/api/workflows?limit=25`);
  });

  it('törzzsel hívva JSON törzset és Content-Type fejlécet küld', async () => {
    let capturedInit: RequestInit | undefined;
    const fetchFunction: FetchFunction = (_input, init) => {
      capturedInit = init;
      return Promise.resolve(jsonResponse(200, { name: 'Alfa' }));
    };

    await performRouteRequest({
      routeId: 'createWorkflow',
      parameters: {},
      query: undefined,
      hasBody: true,
      // eslint-disable-next-line unicorn/no-null -- a `createWorkflow` protokoll séma a hiányzó leírást és providert `null` értékkel írja le, nem `undefined`-nel.
      body: { name: 'Alfa', description: null, providerId: null },
      responseSchema: demoValueSchema,
      fetchFunction,
      apiOrigin: API_ORIGIN,
      signal: undefined,
    });

    expect(capturedInit?.method).toBe('POST');
    // eslint-disable-next-line unicorn/no-null -- ugyanaz a törzs, amit a hívás elküldött (lásd fent).
    expect(capturedInit?.body).toBe(JSON.stringify({ name: 'Alfa', description: null, providerId: null }));
    expect(new Headers(capturedInit?.headers).get('Content-Type')).toBe('application/json');
  });
});
