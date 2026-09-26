import type { FetchFunction } from '@easter-workflow-builder/core';
import { describe, expect, it, vi } from 'vitest';
import { protocolErrorMessage } from '../protocol-error-message/protocol-error-message.ts';
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

    expect(outcome).toMatchObject({ kind: 'error', isTransient: false });
    expect(fetchFunction).not.toHaveBeenCalled();
  });

  it('hálózati hiba esetén átmeneti Outcome hibaágat ad', async () => {
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

    expect(outcome).toEqual({ kind: 'error', message: 'A szerver nem érhető el.', isTransient: true });
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

  it('404 protokoll hibára kizárólag a kód szerinti mondatot adja, a szerver üzenete nélkül', async () => {
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
      message: 'A keresett elem nem létezik, esetleg időközben törölték.',
      isTransient: false,
    });
  });

  // A szerver valódi `already_decided` üzenetének alakja: azonosító és
  // zárójeles hibaosztály (SPEC-005 8.3, 8.4). Egyik sem juthat a felületre,
  // és a mondat pontja után nem állhat kettőspont (user döntés 2026-09-24).
  // Az `errorClass` mező nélküli törzs (a mező előtti szerver válasz) a kód
  // mondatát kapja: a kliens a `message` szövegét nem elemzi.
  it('409 already_decided hibára errorClass nélkül a kód mondatát adja, azonosító, hibaosztály és ".:" nélkül', async () => {
    const serverMessage = 'A(z) "step-run-7f3a" jóváhagyás már el lett döntve (already_decided).';
    const outcome = await performRouteRequest({
      routeId: 'decideApproval',
      parameters: { approvalId: 'approval-1' },
      query: undefined,
      hasBody: true,
      body: { decision: 'approved' },
      responseSchema: demoValueSchema,
      fetchFunction: () => Promise.resolve(jsonResponse(409, { code: 'conflict', message: serverMessage })),
      apiOrigin: API_ORIGIN,
      signal: undefined,
    });

    expect(outcome).toEqual({
      kind: 'error',
      message: 'Az elem állapota most nem engedi a műveletet.',
      isTransient: false,
    });
    const message = outcome.kind === 'error' ? outcome.message : '';
    expect(message).not.toContain('.:');
    expect(message).not.toContain('step-run-7f3a');
    expect(message).not.toContain('already_decided');
  });

  // User döntés 2026-09-26, "Ismert okokra saját mondat": a törzs `errorClass`
  // mezője dönt, a nyers `message` továbbra sem jut a felületre.
  it.each([
    [409, 'conflict', 'already_decided', 'Ezt a jóváhagyást már eldöntötték.'],
    [422, 'unprocessable', 'no_default_provider', 'Nincs alapértelmezett provider beállítva.'],
    [422, 'unprocessable', 'graph_cycle_detected', 'A gráf Ciklus csomópont nélküli kört tartalmaz.'],
  ] as const)(
    'HTTP %i %s hibára az errorClass (%s) saját mondatát adja, a szerver üzenete nélkül',
    async (status, code, errorClass, expected) => {
      const serverMessage = `A(z) "run-7f3a" belső részlet (${errorClass}).`;
      const outcome = await performRouteRequest({
        routeId: 'startRun',
        parameters: { workflowId: 'workflow-1' },
        query: undefined,
        hasBody: true,
        body: { input: {} },
        responseSchema: demoValueSchema,
        fetchFunction: () => Promise.resolve(jsonResponse(status, { code, message: serverMessage, errorClass })),
        apiOrigin: API_ORIGIN,
        signal: undefined,
      });

      expect(outcome).toEqual({ kind: 'error', message: expected, isTransient: false });
      const message = outcome.kind === 'error' ? outcome.message : '';
      expect(message).not.toContain('run-7f3a');
      expect(message).not.toContain(errorClass);
    },
  );

  // A szótáron kívüli `errorClass` a szerződés megsértése: a kliens és a
  // szerver egy repóban, egyszerre élesedik (SPEC-005 8.5), tehát ez csak
  // hibás szerver válaszként fordulhat elő, és a kliens annak is kezeli.
  it('a szótáron kívüli errorClass értékű törzset hibás válaszként kezeli, HTTP státusszal', async () => {
    const outcome = await performRouteRequest({
      routeId: 'getRun',
      parameters: { runId: 'run-1' },
      query: undefined,
      hasBody: false,
      body: undefined,
      responseSchema: demoValueSchema,
      fetchFunction: () =>
        Promise.resolve(
          jsonResponse(500, { code: 'internal', message: 'x (database_closed).', errorClass: 'database_closed' }),
        ),
      apiOrigin: API_ORIGIN,
      signal: undefined,
    });

    expect(outcome).toEqual({
      kind: 'error',
      message: 'A szerver hibás választ adott (HTTP 500).',
      isTransient: false,
    });
  });

  it.each([
    ['invalid_request', 400],
    ['not_found', 404],
    ['conflict', 409],
    ['unprocessable', 422],
    ['internal', 500],
    ['service_unavailable', 503],
  ] as const)('a(z) "%s" kód üzenete pontosan a leképezett mondat (HTTP %i)', async (code, status) => {
    const outcome = await performRouteRequest({
      routeId: 'getRun',
      parameters: { runId: 'run-1' },
      query: undefined,
      hasBody: false,
      body: undefined,
      responseSchema: demoValueSchema,
      fetchFunction: () => Promise.resolve(jsonResponse(status, { code, message: 'belső szöveg (hiba_osztaly)' })),
      apiOrigin: API_ORIGIN,
      signal: undefined,
    });

    expect(outcome).toMatchObject({ kind: 'error', message: protocolErrorMessage(code) });
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

    expect(outcome).toEqual({
      kind: 'error',
      message: 'A szerver hibás választ adott (HTTP 500).',
      isTransient: false,
    });
  });

  // A Vite 8 fejlesztői proxy üres, `text/plain` törzsű 502-t ad, ha a backend
  // nem fogad kapcsolatot (a telepített `vite` forrása, a proxy `error`
  // eseménykezelője); a 503 az RFC 9110 15.6.4 szerinti átmeneti állapot.
  it.each([502, 503])('HTTP %i válaszra átmeneti hibaágat ad', async (status) => {
    const outcome = await performRouteRequest({
      routeId: 'getRun',
      parameters: { runId: 'run-1' },
      query: undefined,
      hasBody: false,
      body: undefined,
      responseSchema: demoValueSchema,
      fetchFunction: () => Promise.resolve(new Response('', { status, headers: { 'Content-Type': 'text/plain' } })),
      apiOrigin: API_ORIGIN,
      signal: undefined,
    });

    expect(outcome).toEqual({
      kind: 'error',
      message: `A szerver hibás választ adott (HTTP ${String(status)}).`,
      isTransient: true,
    });
  });

  it('protokoll hiba törzzsel érkező 503 válaszra is átmeneti hibaágat ad, a kód szerinti mondattal', async () => {
    const outcome = await performRouteRequest({
      routeId: 'getRun',
      parameters: { runId: 'run-1' },
      query: undefined,
      hasBody: false,
      body: undefined,
      responseSchema: demoValueSchema,
      fetchFunction: () => Promise.resolve(jsonResponse(503, { code: 'not_found', message: 'leállás' })),
      apiOrigin: API_ORIGIN,
      signal: undefined,
    });

    expect(outcome).toEqual({
      kind: 'error',
      message: 'A keresett elem nem létezik, esetleg időközben törölték.',
      isTransient: true,
    });
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

    expect(outcome).toEqual({
      kind: 'error',
      message: 'A szerver nem érvényes JSON választ adott.',
      isTransient: false,
    });
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

    expect(outcome).toEqual({ kind: 'error', message: 'A szerver váratlan választ adott (name).', isTransient: false });
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

    expect(outcome).toEqual({
      kind: 'error',
      message: 'A szerver váratlan választ adott ((gyökér)).',
      isTransient: false,
    });
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
