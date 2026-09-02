/* eslint-disable unicorn/no-null -- a wire-szintű rekordok nullable mezői a
   protokoll szerint ténylegesen `null` értéket hordoznak
   (packages/protocol/src/run/run-record.ts,
   .../transcript/run-event-record.ts, .../workflow/workflow-record.ts). */
// SSE e2e a könnyű `node:http` teszt szerveren (T-008-29): a `Last-Event-ID`
// alapú újracsatlakozás. `page.route()` erre a viselkedésre MÉRTEN NEM
// alkalmas (docs/research/2026-08-30-sse-mockolas-meres.md 2.6 szekció: a
// mockolt route második hívása nem hordozza a `Last-Event-ID` fejlécet,
// holott egy valódi szerver felé a böngésző bizonyítottan elküldi) - ezért
// ez az EGYETLEN spec fájl, ami valódi hálózati szervert indít, kizárólag a
// `GET /events` végponthoz; adatbázist nem nyit, motort nem indít. A REST
// hívások továbbra is `page.route()` mockon mennek.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { RunEventRecord, RunSummary, WorkflowSummary } from '@easter-workflow-builder/protocol';
import { encodeStreamFrame } from '@easter-workflow-builder/protocol';
import { expect, test } from './coverage-fixture.ts';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';
import { API_ORIGIN, PREVIEW_ORIGIN } from './api-origin.ts';

// A tényleges portszám az `API_ORIGIN`-ből származik, nem külön literál:
// a valódi teszt szervernek PONTOSAN arra a portra kell kötődnie, amit a
// build időben rögzített `VITE_API_ORIGIN` is hordoz.
const REAL_SERVER_PORT = Number(new URL(API_ORIGIN).port);

const RUN_PENDING: RunSummary = {
  id: 'r-1',
  workflowId: 'w-alfa',
  status: 'pending',
  providerId: 'claude-subscription',
  createdAtMs: 1,
  startedAtMs: null,
  finishedAtMs: null,
  errorKind: null,
  errorMessage: null,
};

const WORKFLOW: WorkflowSummary = {
  id: 'w-alfa',
  name: 'Alfa workflow',
  description: null,
  providerId: null,
  createdAtMs: 1,
  updatedAtMs: 1,
};

const RUN_EVENT_RECORD: RunEventRecord = {
  id: 5,
  runId: 'r-1',
  stepRunId: null,
  origin: 'engine',
  kind: 'run_finished',
  occurredAtMs: 3,
  sdkMessageType: null,
  sdkMessageSubtype: null,
  sdkSessionId: null,
  sdkUuid: null,
  parentToolUseId: null,
  toolName: null,
  toolUseId: null,
  inputTokens: null,
  outputTokens: null,
  cacheReadInputTokens: null,
  cacheCreationInputTokens: null,
  numTurns: null,
  payload: {},
};

function readSingleHeaderValue(value: string | readonly string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/**
 * A második kérés `Last-Event-ID` fejlécét fogja: `undefined`, amíg a
 * második kérés meg nem érkezik. A teszt ezt web-first `expect.poll`-lal
 * várja meg, `page.waitForTimeout()` nélkül.
 */
function startSseTestServer(capturedLastEventId: { value: string | undefined }): Server {
  let requestCount = 0;
  const server = createServer((request: IncomingMessage, response: ServerResponse) => {
    if (!request.url?.startsWith('/events')) {
      response.writeHead(404).end();
      return;
    }
    requestCount += 1;
    // A Vite preview szerver és ez a teszt szerver más origin (4173 kontra
    // `API_ORIGIN` 4174), tehát az `EventSource` valódi, hitelesítő adatok
    // nélküli CORS kérést indít: `Access-Control-Allow-Origin` fejléc nélkül
    // a böngésző a választ nem adja át a JS rétegnek (a `readyState` sosem
    // ér OPEN-ig, a `page.route()`-mockolt esetekkel ellentétben, ahol a
    // CDP által teljesített válasz nem megy át ezen az ellenőrzésen).
    response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Access-Control-Allow-Origin': PREVIEW_ORIGIN });
    if (requestCount === 1) {
      // Rövid retry, hogy a böngésző gyorsan újracsatlakozzon, majd a
      // kapcsolat zárása: az `end()` a HTTP válasz lezárása, amit a natív
      // `EventSource` automatikus újracsatlakozásként értelmez.
      response.write('retry: 50\n\n');
      response.write(encodeStreamFrame({ event: 'run_event', delivery: 'live', runEvent: RUN_EVENT_RECORD }));
      response.end();
      return;
    }
    capturedLastEventId.value = readSingleHeaderValue(request.headers['last-event-id']);
    response.write(
      encodeStreamFrame({
        event: 'run_event_transient',
        runId: 'r-1',
        stepRunId: null,
        kind: 'sdk_stream_event',
        occurredAtMs: 10,
        payload: { reconnected: true },
      }),
    );
    // A kapcsolatot nyitva hagyja: a teszt csak azt igazolja, hogy a
    // második kérés megérkezett a helyes fejléccel, nem kell tovább zárni.
  });
  server.listen(REAL_SERVER_PORT);
  return server;
}

const serverHolder: { current: Server | undefined } = { current: undefined };
const capturedLastEventId: { value: string | undefined } = { value: undefined };

test.beforeEach(async ({ page }) => {
  capturedLastEventId.value = undefined;
  serverHolder.current = startSseTestServer(capturedLastEventId);
  await installApiMocks(page, [
    mockRoute('listRuns', async (route) => route.fulfill(jsonBody([RUN_PENDING]))),
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([WORKFLOW]))),
    mockRoute('replaceStreamSubscriptions', async (route) =>
      route.fulfill(jsonBody({ streamId: 'e2e-stream', subscriptions: [] })),
    ),
  ]);
});

test.afterEach(() => {
  serverHolder.current?.close();
});

test('a második SSE kapcsolat Last-Event-ID fejlécet küld, a szerver onnan folytat', async ({ page }) => {
  await page.goto('/runs');
  await expect(page.getByRole('table', { name: 'Futások' })).toBeVisible();

  // A végállapotot web-first `expect.poll` várja meg: a második kapcsolat
  // ténylegesen megtörtént ÉS a helyes Last-Event-ID fejlécet hordozta (a
  // kutatás 2.10 demonstrációjának mintája).
  await expect.poll(() => capturedLastEventId.value).toBe('5');
});
