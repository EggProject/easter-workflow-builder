/* eslint-disable unicorn/no-null -- a wire-szintű rekordok nullable mezői a
   protokoll szerint ténylegesen `null` értéket hordoznak
   (packages/protocol/src/run/run-record.ts,
   .../transcript/run-event-record.ts, .../workflow/workflow-record.ts). */
// SSE e2e a könnyű `node:http` teszt szerveren (T-008-29). Ez az EGYETLEN
// spec fájl, ami valódi hálózati szervert indít, kizárólag a `GET /events`
// végponthoz; adatbázist nem nyit, motort nem indít, és a REST hívások itt is
// `page.route()` mockon mennek.
//
// MIÉRT KELL VALÓDI SZERVER. A `docs/research/2026-08-30-sse-mockolas-meres.md`
// szerint a `page.route()` az alapeset, HÁROM, mérten bizonyított kivétellel -
// mind a három ebben a fájlban áll:
//   1. a `Last-Event-ID` alapú újracsatlakozás fejléc szintű ellenőrzése (2.6
//      mérés: a mockolt route második hívása nem hordozza a fejlécet, holott
//      egy valódi szerver felé a böngésző bizonyítottan elküldi),
//   2. egy már megnyitott kapcsolatba MENET KÖZBEN beszúrt új keret (a
//      `route.fulfill()` egyszeri, lezárt aktus: "Route is already handled!"),
//   3. bármely állítás, aminek a kapcsolat NYITVA maradása az előfeltétele -
//      például a `replaying` és a `live` fázis (2026-09-05-i saját mérés,
//      `docs/research/2026-09-05-e2e-lefedettsegi-kuszob.md` 4. szekció): a
//      `route.fulfill()` lezárt válasz, tehát az `EventSource` a keretek után
//      azonnal `error`-t kap, a `readyState` kiesik `OPEN`-ből, és a
//      `computePhase` `reconnecting` ágára fut - a `replaying` felirat így
//      csak egy meg nem figyelhető pillanatra jelenik meg.
//
// SOROS FUTÁS. A teszt szerver a `VITE_STREAM_ORIGIN` build időben rögzített
// portjára kötődik (nem választható meg szabadon, mert az `EventSource` URL-je
// abból épül), tehát egyszerre csak egy teszt tarthatja. A `fullyParallel`
// beállítás a fájlon BELÜL is párhuzamosítana, ezért ez a fájl a dokumentált
// `mode: 'serial'` beállítást kapja.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { RunEventRecord, RunSummary, StreamFrame, WorkflowSummary } from '@easter-workflow-builder/protocol';
import { encodeStreamFrame } from '@easter-workflow-builder/protocol';
import { expect, test } from './coverage-fixture.ts';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';
import { PREVIEW_ORIGIN, STREAM_ORIGIN } from './api-origin.ts';

test.describe.configure({ mode: 'serial' });

// A tényleges portszám a `STREAM_ORIGIN`-ből származik, nem külön literál:
// a valódi teszt szervernek PONTOSAN arra a portra kell kötődnie, amit a
// build időben rögzített `VITE_STREAM_ORIGIN` is hordoz.
const REAL_SERVER_PORT = Number(new URL(STREAM_ORIGIN).port);

/**
 * A Vite preview szerver és ez a teszt szerver más origin (4173 kontra
 * `STREAM_ORIGIN` 4174), tehát az `EventSource` valódi, hitelesítő adatok
 * nélküli CORS kérést indít: `Access-Control-Allow-Origin` fejléc nélkül a
 * böngésző a választ nem adja át a JS rétegnek (a `readyState` sosem ér
 * OPEN-ig, a `page.route()`-mockolt esetekkel ellentétben, ahol a CDP által
 * teljesített válasz nem megy át ezen az ellenőrzésen).
 */
const SSE_RESPONSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Access-Control-Allow-Origin': PREVIEW_ORIGIN,
};

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

/**
 * Egy `stream_ready` keret a megadott szerver példány azonosítóval, és
 * annyi feliratkozással, ahány futás pótlás alatt áll. A `subscriptions`
 * alakja azonos a `PUT` válaszáéval (`stream-subscription.ts`).
 */
function streamReadyFrame(serverInstanceId: string, replayingRunIds: readonly string[]): StreamFrame {
  return {
    event: 'stream_ready',
    streamId: 'e2e-stream',
    serverInstanceId,
    subscriptions: replayingRunIds.map((runId) => ({ runId, fromEventId: 0, replayLimit: 100 })),
  };
}

function readSingleHeaderValue(value: string | readonly string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/**
 * A második kérés `Last-Event-ID` fejlécét fogja: `undefined`, amíg a
 * második kérés meg nem érkezik. A teszt ezt web-first `expect.poll`-lal
 * várja meg, `page.waitForTimeout()` nélkül.
 */
function startLastEventIdServer(capturedLastEventId: { value: string | undefined }): Server {
  let requestCount = 0;
  const server = createServer((request: IncomingMessage, response: ServerResponse) => {
    if (request.url?.startsWith('/events') !== true) {
      response.writeHead(404).end();
      return;
    }
    requestCount += 1;
    response.writeHead(200, SSE_RESPONSE_HEADERS);
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

interface OpenStreamServer {
  readonly server: Server;
  /**
   * Új keret beszúrása a MÁR MEGNYITOTT kapcsolatba. Ha a böngésző még nem
   * csatlakozott, a keret a sorban vár, és a csatlakozáskor megy ki.
   */
  readonly push: (frame: StreamFrame) => void;
}

/**
 * `GET /events` végpont, ami a megadott kereteket kiírja és a kapcsolatot
 * NYITVA HAGYJA. Enélkül a `readyState` kiesik `OPEN`-ből, és a
 * `computePhase` `replaying`/`live` ága nem figyelhető meg.
 */
function startOpenStreamServer(initialFrames: readonly StreamFrame[]): OpenStreamServer {
  const openResponses: ServerResponse[] = [];
  const pendingFrames: StreamFrame[] = [];

  const server = createServer((request: IncomingMessage, response: ServerResponse) => {
    if (request.url?.startsWith('/events') !== true) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, SSE_RESPONSE_HEADERS);
    openResponses.push(response);
    for (const frame of [...initialFrames, ...pendingFrames]) {
      response.write(encodeStreamFrame(frame));
    }
  });
  server.listen(REAL_SERVER_PORT);

  return {
    server,
    push: (frame) => {
      pendingFrames.push(frame);
      for (const response of openResponses) {
        response.write(encodeStreamFrame(frame));
      }
    },
  };
}

const serverHolder: { current: Server | undefined } = { current: undefined };

test.beforeEach(async ({ page }) => {
  await installApiMocks(page, [
    mockRoute('listRuns', async (route) => route.fulfill(jsonBody([RUN_PENDING]))),
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([WORKFLOW]))),
    mockRoute('replaceStreamSubscriptions', async (route) =>
      route.fulfill(jsonBody({ streamId: 'e2e-stream', subscriptions: [] })),
    ),
  ]);
});

test.afterEach(() => {
  // A `closeAllConnections()` KELL a `close()` mellé: a nyitva hagyott SSE
  // kapcsolat egyébként életben tartaná a szervert, és a soron következő
  // teszt `listen()` hívása ugyanarra a portra `EADDRINUSE`-szal bukna.
  serverHolder.current?.closeAllConnections();
  serverHolder.current?.close();
  serverHolder.current = undefined;
});

test('a második SSE kapcsolat Last-Event-ID fejlécet küld, a szerver onnan folytat', async ({ page }) => {
  const capturedLastEventId: { value: string | undefined } = { value: undefined };
  serverHolder.current = startLastEventIdServer(capturedLastEventId);

  await page.goto('/runs');
  await expect(page.getByRole('table', { name: 'Futások' })).toBeVisible();

  // A végállapotot web-first `expect.poll` várja meg: a második kapcsolat
  // ténylegesen megtörtént ÉS a helyes Last-Event-ID fejlécet hordozta (a
  // kutatás 2.10 demonstrációjának mintája).
  await expect.poll(() => capturedLastEventId.value).toBe('5');
});

test('feliratkozással érkező stream_ready "előzmények betöltése" fázist mutat, a replay_complete leveszi', async ({
  page,
}) => {
  const streamServer = startOpenStreamServer([streamReadyFrame('s-1', ['r-1'])]);
  serverHolder.current = streamServer.server;

  await page.goto('/runs');
  await expect(page.getByRole('table', { name: 'Futások' })).toBeVisible();
  await expect(page.getByText('előzmények betöltése')).toBeVisible();

  // MENET KÖZBEN beszúrt keret: pontosan az, amit a `route.fulfill()` nem tud.
  streamServer.push({ event: 'replay_complete', runId: 'r-1', throughEventId: 1 });

  // Az `élő` fázisnak nincs önálló felirata (SPEC-007 11. szekció), tehát a
  // pótlás vége éppen a felirat eltűnésén látszik.
  await expect(page.getByText('előzmények betöltése')).toBeHidden();
});

test('nem ismert runId-jű replay_complete nem változtat a pótlás alatti futásokon', async ({ page }) => {
  const streamServer = startOpenStreamServer([streamReadyFrame('s-1', ['r-1'])]);
  serverHolder.current = streamServer.server;

  await page.goto('/runs');
  await expect(page.getByText('előzmények betöltése')).toBeVisible();

  streamServer.push({ event: 'replay_complete', runId: 'r-nincs-ilyen', throughEventId: 1 });

  // A halmaz változatlan, tehát a felirat marad. A `toBeVisible()` web-first
  // állítás a keret feldolgozása utáni állapoton is igaz marad, mert a
  // `setPendingReplayRunIds` frissítője az előző halmazt adja vissza.
  await expect(page.getByText('előzmények betöltése')).toBeVisible();
});
