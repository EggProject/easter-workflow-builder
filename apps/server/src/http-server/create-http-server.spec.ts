import { describe, expect, it, afterEach } from 'vitest';
import type { RouteId } from '@easter-workflow-builder/protocol';
import type { RouteHandler, RouteHandlerContext } from '../route-dispatch/route-handler.ts';
import { createHttpServer, type HttpServerOptions } from './create-http-server.ts';

const DEFAULT_HANDLER: RouteHandler = () => Promise.resolve({ kind: 'ok', value: { status: 200, body: { ok: true } } });

/**
 * A `ROUTE_TABLE` mind a 26 kulcsára egy alapértelmezett, felülírható
 * kezelőt ad, hogy a `HttpServerOptions.handlers` kimerítő rekordja a
 * tesztben is előálljon, kézzel felsorolva - ugyanaz a minta, mint ahogy a
 * valós összeállítás (`route-registry` téma) is felépíti majd.
 */
function buildHandlers(overrides: Partial<Record<RouteId, RouteHandler>>): Record<RouteId, RouteHandler> {
  const base: Record<RouteId, RouteHandler> = {
    listWorkflows: DEFAULT_HANDLER,
    createWorkflow: DEFAULT_HANDLER,
    getWorkflow: DEFAULT_HANDLER,
    updateWorkflow: DEFAULT_HANDLER,
    deleteWorkflow: DEFAULT_HANDLER,
    summarizeWorkflowDeletion: DEFAULT_HANDLER,
    readWorkflowGraph: DEFAULT_HANDLER,
    replaceWorkflowGraph: DEFAULT_HANDLER,
    startRun: DEFAULT_HANDLER,
    listRuns: DEFAULT_HANDLER,
    getRun: DEFAULT_HANDLER,
    readRunSnapshot: DEFAULT_HANDLER,
    listStepRuns: DEFAULT_HANDLER,
    readRunEvents: DEFAULT_HANDLER,
    interruptRun: DEFAULT_HANDLER,
    restartRun: DEFAULT_HANDLER,
    listPendingApprovals: DEFAULT_HANDLER,
    decideApproval: DEFAULT_HANDLER,
    listProviders: DEFAULT_HANDLER,
    testProviderConnection: DEFAULT_HANDLER,
    readSettings: DEFAULT_HANDLER,
    updateSettings: DEFAULT_HANDLER,
    listConcurrencyLimits: DEFAULT_HANDLER,
    setConcurrencyLimit: DEFAULT_HANDLER,
    clearConcurrencyLimit: DEFAULT_HANDLER,
    replaceStreamSubscriptions: DEFAULT_HANDLER,
  };
  return { ...base, ...overrides };
}

async function startTestServer(options: HttpServerOptions): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server = createHttpServer(options);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('A teszt szerver nem kapott portot.');
  }
  return {
    baseUrl: `http://127.0.0.1:${String(address.port)}`,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      }),
  };
}

describe('createHttpServer', () => {
  let closeServer: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (closeServer === undefined) {
      return;
    }
    await closeServer();
    closeServer = undefined;
  });

  it('ismert útvonalon a kezelő válaszát adja vissza', async () => {
    const { baseUrl, close } = await startTestServer({
      handlers: buildHandlers({
        listWorkflows: () => Promise.resolve({ kind: 'ok', value: { status: 200, body: [{ id: '1' }] } }),
      }),
      devOrigin: undefined,
    });
    closeServer = close;

    const response = await fetch(`${baseUrl}/api/workflows?limit=10`);
    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual([{ id: '1' }]);
  });

  it('a kezelő megkapja az útvonal paramétert, a query stringet és a JSON törzset', async () => {
    let seen: RouteHandlerContext | undefined;
    const { baseUrl, close } = await startTestServer({
      handlers: buildHandlers({
        updateWorkflow: (context) => {
          seen = context;
          return Promise.resolve({ kind: 'ok', value: { status: 200, body: { received: true } } });
        },
      }),
      devOrigin: undefined,
    });
    closeServer = close;

    await fetch(`${baseUrl}/api/workflows/wf-1?verbose=1`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'új név' }),
    });

    expect(seen?.parameters).toStrictEqual({ workflowId: 'wf-1' });
    expect(seen?.query.get('verbose')).toBe('1');
    expect(seen?.body).toStrictEqual({ name: 'új név' });
  });

  it('ismeretlen útvonalra 404-et ad, not_found kóddal', async () => {
    const { baseUrl, close } = await startTestServer({ handlers: buildHandlers({}), devOrigin: undefined });
    closeServer = close;

    const response = await fetch(`${baseUrl}/api/nincs-ilyen`);
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: 'not_found' });
  });

  it('ismert útvonalon rossz metódusra 405-öt ad, Allow fejléccel', async () => {
    const { baseUrl, close } = await startTestServer({ handlers: buildHandlers({}), devOrigin: undefined });
    closeServer = close;

    const response = await fetch(`${baseUrl}/api/workflows`, { method: 'DELETE' });
    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('GET, POST');
    expect(await response.json()).toMatchObject({ code: 'not_found' });
  });

  it('rosszul formázott JSON törzsre 400-at ad, invalid_request kóddal, a nyers törzs visszhangzása nélkül', async () => {
    const { baseUrl, close } = await startTestServer({ handlers: buildHandlers({}), devOrigin: undefined });
    closeServer = close;

    const response = await fetch(`${baseUrl}/api/workflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{titkos-token: "nem json',
    });
    expect(response.status).toBe(400);
    const payload: unknown = await response.json();
    expect(payload).toMatchObject({ code: 'invalid_request' });
    expect(JSON.stringify(payload)).not.toContain('titkos-token');
  });

  it('a kezelő Outcome hibaágát a mapOutcomeMessageToErrorCode szerinti státuszra képezi', async () => {
    const { baseUrl, close } = await startTestServer({
      handlers: buildHandlers({
        getWorkflow: () =>
          Promise.resolve({ kind: 'error', message: 'A(z) "x" workflow nem található (not_found).' }),
      }),
      devOrigin: undefined,
    });
    closeServer = close;

    const response = await fetch(`${baseUrl}/api/workflows/x`);
    expect(response.status).toBe(404);
    expect(await response.json()).toStrictEqual({
      code: 'not_found',
      message: 'A(z) "x" workflow nem található (not_found).',
    });
  });

  it('204 státusznál nincs válasz törzs', async () => {
    const { baseUrl, close } = await startTestServer({
      handlers: buildHandlers({
        clearConcurrencyLimit: () => Promise.resolve({ kind: 'ok', value: { status: 204, body: undefined } }),
      }),
      devOrigin: undefined,
    });
    closeServer = close;

    const response = await fetch(`${baseUrl}/api/settings/concurrency-limits/minimax`, { method: 'DELETE' });
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
  });

  it('a stream útvonalon konfigurált fejlesztői origin esetén CORS fejlécet küld', async () => {
    const { baseUrl, close } = await startTestServer({
      handlers: buildHandlers({}),
      devOrigin: 'http://localhost:5173',
    });
    closeServer = close;

    const response = await fetch(`${baseUrl}/events`);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBeNull();
  });

  it('nem stream útvonalon konfigurált origin mellett sem küld CORS fejlécet', async () => {
    const { baseUrl, close } = await startTestServer({
      handlers: buildHandlers({}),
      devOrigin: 'http://localhost:5173',
    });
    closeServer = close;

    const response = await fetch(`${baseUrl}/api/workflows`);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('a kezelőben eldobott kivételre 500-at ad, a hiba részletei nélkül', async () => {
    const { baseUrl, close } = await startTestServer({
      handlers: buildHandlers({
        listWorkflows: () => {
          throw new Error('titkos verem nyomkövetési részlet');
        },
      }),
      devOrigin: undefined,
    });
    closeServer = close;

    const response = await fetch(`${baseUrl}/api/workflows`);
    expect(response.status).toBe(500);
    const payload: unknown = await response.json();
    expect(payload).toStrictEqual({ code: 'internal', message: 'Váratlan szerver hiba történt (internal).' });
  });
});
