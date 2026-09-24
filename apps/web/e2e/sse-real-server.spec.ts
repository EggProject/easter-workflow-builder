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
import { createServer as createNetServer, type Server as NetServer } from 'node:net';
import type {
  RunDetail,
  RunEventKind,
  RunEventRecord,
  RunSnapshotResponse,
  RunSummary,
  StepRunRecord,
  StreamFrame,
  WorkflowSummary,
} from '@easter-workflow-builder/protocol';
import { encodeStreamFrame } from '@easter-workflow-builder/protocol';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './coverage-fixture.ts';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';
import { PREVIEW_ORIGIN, STREAM_ORIGIN } from './api-origin.ts';
import { makeRunEventRecord } from './transcript-fixture.ts';

declare global {
  // Ambiens globális változó deklaráció, a `coverage-fixture.ts` mintájára: a
  // TypeScript a `globalThis` kiegészítését csak `var` alakban engedi.
  /**
   * A lapon belül KIADOTT `GET /api/runs/{runId}/steps` kérések száma
   * (T-009-25a). A lapon belül számol, a `fetch` hívás pillanatában, nem a
   * Playwright route kezelőjében, mert az utóbbi aszinkron fut: egy késve
   * meghívott kezelő miatt a számláló a felület állapotához képest lemaradhatna.
   */
  var e2eStepRunFetchCounter: { count: number } | undefined;
  /**
   * A lap betöltése UTÁN beállított jelző: ha a lap újratöltődne, eltűnne.
   */
  var e2eNoReloadMarker: boolean | undefined;
}

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
  /**
   * Több keret beszúrása EGYETLEN `write` hívással, tehát egy hálózati
   * darabban, egy löketben: pontosan így érkezik a szerver pótlása
   * (`apps/server` `handle-stream-connection.ts` `replayRun`), és a végén
   * szinkron kiírt `replay_complete` (T-009-25a).
   */
  readonly pushBatch: (frames: readonly StreamFrame[]) => void;
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
    pushBatch: (frames) => {
      pendingFrames.push(...frames);
      const chunk = frames.map((frame) => encodeStreamFrame(frame)).join('');
      for (const response of openResponses) {
        response.write(chunk);
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

// ============================================================
// A "MEGSZAKÍTÁS FOLYAMATBAN" ÁLLAPOT LEZÁRÁSA (T-009-23, SPEC-008 6.4, AC25).
//
// Ez a mérés a fenti 2. kivétel alá tartozik: egy MÁR MEGNYITOTT kapcsolatba
// menet közben beszúrt `run_finished` keret hatását vizsgálja, amit a
// `page.route()` mock nem tud előállítani ("Route is already handled!"). A
// keret ELŐTTI, fennmaradó állapotot a `run-control.spec.ts` méri, mockolt
// kapcsolaton.
// ============================================================

/* eslint-disable unicorn/no-null -- lásd a fájl fejlécének eslint-disable indoklását */

const RUN_SNAPSHOT: RunSnapshotResponse = {
  version: 1,
  sdkVersionPin: '0.1.13',
  workflow: { id: 'w-alfa', name: 'Alfa workflow', description: null },
  nodes: [
    {
      id: 'n1',
      type: 'start',
      label: 'Kérés fogadása',
      position: { x: 0, y: 0 },
      config: { type: 'start', inputFields: [], onUnhandledError: null },
      effectiveProviderId: 'claude-subscription',
    },
  ],
  edges: [],
};

const NO_STEP_RUNS: readonly StepRunRecord[] = [];

function runDetailWithStatus(status: RunDetail['status']): RunDetail {
  return {
    id: 'r-1',
    workflowId: 'w-alfa',
    status,
    input: null,
    providerId: 'claude-subscription',
    rootRunId: 'r-1',
    depth: 0,
    workflowAncestry: ['w-alfa'],
    graphSnapshotHash: 'd'.repeat(64),
    persistedStreamDeltas: false,
    restartedFromRunId: null,
    createdAtMs: 1,
    startedAtMs: 2,
    finishedAtMs: status === 'running' ? null : 9,
    errorKind: null,
    errorMessage: null,
  };
}

/* eslint-enable unicorn/no-null */

test('a megszakítás folyamatban állapotot a MENET KÖZBEN érkező run_finished keret zárja le', async ({ page }) => {
  const streamServer = startOpenStreamServer([streamReadyFrame('s-1', [])]);
  serverHolder.current = streamServer.server;

  // A szerver oldali futás állapota a keret kiadása ELŐTT `running`, utána
  // `cancelled`: a felület a `run_finished` keretre töltI újra a futás
  // rekordját, és ettől vált a vezérlő sáv.
  const runStatusHolder: { current: RunDetail['status'] } = { current: 'running' };
  await installApiMocks(page, [
    mockRoute('getRun', async (route) => route.fulfill(jsonBody(runDetailWithStatus(runStatusHolder.current)))),
    mockRoute('readRunSnapshot', async (route) => route.fulfill(jsonBody(RUN_SNAPSHOT))),
    mockRoute('listStepRuns', async (route) => route.fulfill(jsonBody(NO_STEP_RUNS))),
    mockRoute('listPendingApprovals', async (route) => route.fulfill(jsonBody([]))),
    mockRoute('replaceStreamSubscriptions', async (route) =>
      route.fulfill(jsonBody({ streamId: 'e2e-stream', subscriptions: [] })),
    ),
    mockRoute('interruptRun', async (route) => route.fulfill(jsonBody({ rootRunId: 'r-1', cancelledRunIds: ['r-1'] }))),
  ]);

  await page.goto('/run?runId=r-1');
  const interruptButton = page.getByRole('button', { name: 'Megszakítás' });
  await interruptButton.click();
  await expect(page.getByText('Megszakítás folyamatban')).toBeVisible();
  await expect(interruptButton).toBeDisabled();

  runStatusHolder.current = 'cancelled';
  streamServer.push({ event: 'run_event', delivery: 'live', runEvent: RUN_EVENT_RECORD });

  await expect(page.getByText('Megszakítás folyamatban')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Újraindítás' })).toBeVisible();
});

// ============================================================
// A CSOMÓPONTOK ÉLŐ ÁLLAPOTA ÉS A LÖKETBEN ÉRKEZŐ KERETEK (T-009-25a,
// SPEC-008 6.2).
//
// Mind a fenti 2. és 3. kivétel alá tartozik: egy MÁR MEGNYITOTT, nyitva
// maradó kapcsolatba menet közben beszúrt keretek hatását vizsgálja. A
// `pushBatch` több keretet EGYETLEN `write` hívással küld, ahogy a szerver a
// pótlást és a végén a `replay_complete` keretet: egy "legutolsó keret"
// alakú állapot egy ilyen löketből csak az utolsót adná át.
// ============================================================

/* eslint-disable unicorn/no-null -- lásd a fájl fejlécének eslint-disable indoklását */

function stepRun(status: StepRunRecord['status']): StepRunRecord {
  return {
    id: 's-1',
    runId: 'r-1',
    nodeId: 'n1',
    nodeType: 'start',
    parentStepRunId: null,
    iteration: 0,
    attempt: 1,
    status,
    providerId: 'claude-subscription',
    modelId: null,
    sessionMode: null,
    sdkSessionId: null,
    resumedFromSessionId: null,
    forkedSession: false,
    structuredOutputStrategy: null,
    output: null,
    resultSubtype: null,
    numTurns: null,
    inputTokens: null,
    outputTokens: null,
    cacheReadInputTokens: null,
    cacheCreationInputTokens: null,
    subWorkflowRunId: null,
    errorKind: null,
    errorMessage: null,
    startedAtMs: 2,
    finishedAtMs: null,
    createdAtMs: 2,
  };
}

/* eslint-enable unicorn/no-null */

/**
 * Egy lépés szintű motor esemény kerete az `r-1` futás `s-1` lépés futására.
 */
function stepEventFrame(id: number, kind: RunEventKind, delivery: 'live' | 'replayed'): StreamFrame {
  return {
    event: 'run_event',
    delivery,
    runEvent: makeRunEventRecord(id, 'r-1', { stepRunId: 's-1', kind }),
  };
}

/**
 * A kiadott `listStepRuns` kérések számlálója a lapon belül, a lap saját
 * `fetch` hívásába kötve, a betöltés ELŐTT (`addInitScript`).
 */
async function installStepRunFetchCounter(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const originalFetch = globalThis.fetch.bind(globalThis);
    const counter = { count: 0 };
    // `Object.defineProperties`, nem értékadás: a globális objektum
    // tulajdonságának közvetlen írását a lint tiltja
    // (`unicorn/no-global-object-property-assignment`).
    Object.defineProperties(globalThis, {
      e2eStepRunFetchCounter: { configurable: true, value: counter },
      fetch: {
        configurable: true,
        writable: true,
        value: (...parameters: Parameters<typeof fetch>) => {
          const [input] = parameters;
          const url = input instanceof Request ? input.url : String(input);
          if (new URL(url).pathname.endsWith('/steps')) {
            counter.count += 1;
          }
          return originalFetch(...parameters);
        },
      },
    });
  });
}

async function readStepRunFetchCount(page: Page): Promise<number | undefined> {
  return page.evaluate(() => globalThis.e2eStepRunFetchCounter?.count);
}

async function setNoReloadMarker(page: Page): Promise<void> {
  await page.evaluate(() => {
    Object.defineProperty(globalThis, 'e2eNoReloadMarker', { configurable: true, value: true });
  });
}

async function readNoReloadMarker(page: Page): Promise<boolean | undefined> {
  return page.evaluate(() => globalThis.e2eNoReloadMarker);
}

/**
 * Lásd a `run-view.spec.ts` `nodeLocator` doksiját: a `getByTestId`
 * kizárólag a React Flow saját, dokumentált `rf__` előtagú fogódzójára áll
 * (SPEC-008 12.3 locator kivétel).
 */
function nodeLocator(page: Page, nodeId: string): Locator {
  return page.getByTestId(`rf__node-${nodeId}`);
}

interface RunViewMockState {
  runStatus: RunDetail['status'];
  stepRuns: readonly StepRunRecord[];
}

/**
 * A futás nézet REST mockjai: a futás rekordja és a lépés futások a teszt
 * által menet közben átírható `state` objektumból jönnek.
 */
async function mockRunView(page: Page, state: RunViewMockState): Promise<void> {
  await installApiMocks(page, [
    mockRoute('getRun', async (route) => route.fulfill(jsonBody(runDetailWithStatus(state.runStatus)))),
    mockRoute('readRunSnapshot', async (route) => route.fulfill(jsonBody(RUN_SNAPSHOT))),
    mockRoute('listStepRuns', async (route) => route.fulfill(jsonBody(state.stepRuns))),
    mockRoute('listPendingApprovals', async (route) => route.fulfill(jsonBody([]))),
    mockRoute('replaceStreamSubscriptions', async (route) =>
      route.fulfill(jsonBody({ streamId: 'e2e-stream', subscriptions: [] })),
    ),
  ]);
}

for (const finished of [
  { status: 'succeeded', label: 'sikeres' },
  { status: 'failed', label: 'sikertelen' },
] as const) {
  test(`élő step_started keretre "fut", step_finished keretre "${finished.label}" jelvény a csomóponton, oldal újratöltés nélkül`, async ({
    page,
  }) => {
    const streamServer = startOpenStreamServer([streamReadyFrame('s-1', [])]);
    serverHolder.current = streamServer.server;
    const state: RunViewMockState = { runStatus: 'running', stepRuns: [] };
    await mockRunView(page, state);

    await page.goto('/run?runId=r-1');
    const node = nodeLocator(page, 'n1');
    await expect(node).toBeVisible();
    await expect(node.getByText('fut', { exact: true })).toBeHidden();
    await setNoReloadMarker(page);

    state.stepRuns = [stepRun('running')];
    streamServer.push(stepEventFrame(1, 'step_started', 'live'));
    await expect(node.getByText('fut', { exact: true })).toBeVisible();

    state.stepRuns = [stepRun(finished.status)];
    streamServer.push(stepEventFrame(2, 'step_finished', 'live'));
    await expect(node.getByText(finished.label, { exact: true })).toBeVisible();
    await expect(node.getByText('fut', { exact: true })).toBeHidden();

    expect(await readNoReloadMarker(page)).toBe(true);
  });
}

test('egy löketben érkező ezer keretes pótlás után a csomópont állapota helyes, és pontosan EGY újratöltés fut', async ({
  page,
}) => {
  // A `stream_ready` a futást pótlás alatt állónak jelzi: a topnav az
  // "előzmények betöltése" fázist mutatja, amíg a `replay_complete` meg nem jön.
  const streamServer = startOpenStreamServer([streamReadyFrame('s-1', ['r-1'])]);
  serverHolder.current = streamServer.server;
  const state: RunViewMockState = { runStatus: 'running', stepRuns: [stepRun('running')] };
  await mockRunView(page, state);
  await installStepRunFetchCounter(page);

  await page.goto('/run?runId=r-1');
  const node = nodeLocator(page, 'n1');
  await expect(node.getByText('fut', { exact: true })).toBeVisible();
  await expect(page.getByText('előzmények betöltése', { exact: true })).toBeVisible();
  expect(await readStepRunFetchCount(page)).toBe(1);

  // A szerver oldali állapot a pótlásban szereplő események UTÁN: a lépés
  // lezárult. A löket 1000 pótolt keret (lépés és SDK események vegyesen),
  // a végén a futás `replay_complete` kerete, mind EGY hálózati darabban.
  state.stepRuns = [stepRun('succeeded')];
  const replayKinds: readonly RunEventKind[] = ['step_started', 'sdk_assistant', 'sdk_user', 'step_finished'];
  const replayed = Array.from({ length: 1000 }, (_, index) =>
    stepEventFrame(index + 1, replayKinds[index % replayKinds.length] ?? 'step_started', 'replayed'),
  );
  streamServer.pushBatch([...replayed, { event: 'replay_complete', runId: 'r-1', throughEventId: 1000 }]);

  await expect(node.getByText('sikeres', { exact: true })).toBeVisible();
  await expect(page.getByText('előzmények betöltése', { exact: true })).toBeHidden();
  // A lapon belüli számláló a `fetch` kiadásakor nő, tehát a felület "sikeres"
  // állapotában már minden kiváltott kérést tartalmaz: a csatoláskori betöltés
  // és a `replay_complete` keretre indított EGY újratöltés.
  expect(await readStepRunFetchCount(page)).toBe(2);

  // Az élő szakasz ezután is frissít: egy élő jelző keret pontosan egy újabb
  // kérést ad.
  state.stepRuns = [stepRun('failed')];
  streamServer.push(stepEventFrame(1001, 'step_finished', 'live'));
  await expect(node.getByText('sikertelen', { exact: true })).toBeVisible();
  expect(await readStepRunFetchCount(page)).toBe(3);
});

test('a run_finished keret a fejlécet akkor is lezárja, ha UGYANABBAN a löketben replay_complete követi', async ({
  page,
}) => {
  const streamServer = startOpenStreamServer([streamReadyFrame('s-1', [])]);
  serverHolder.current = streamServer.server;
  const state: RunViewMockState = { runStatus: 'running', stepRuns: [] };
  await mockRunView(page, state);

  await page.goto('/run?runId=r-1');
  await expect(page.getByRole('button', { name: 'Megszakítás' })).toBeVisible();

  // A szerver a pótlás végén SZINKRON írja a `replay_complete` keretet: a
  // `run_finished` így nem a löket utolsó kerete.
  state.runStatus = 'succeeded';
  streamServer.pushBatch([
    { event: 'run_event', delivery: 'replayed', runEvent: RUN_EVENT_RECORD },
    { event: 'replay_complete', runId: 'r-1', throughEventId: RUN_EVENT_RECORD.id },
  ]);

  await expect(page.getByRole('button', { name: 'Újraindítás' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Megszakítás' })).toBeHidden();
});

// ============================================================
// A FUTÁS LEZÁRÁSA SZABÁLYOS LEÁLLÁSKOR ÉS A SZERVER ÚJRAINDULÁS (SPEC-004
// 10.1, 10.2, SPEC-005 5.2, SPEC-007 AC44).
//
// Mind a fenti 2. és 3. kivétel alá tartozik: a `run_interrupted` keret egy
// MÁR MEGNYITOTT kapcsolatba érkezik menet közben, az újraindulás pedig a
// kapcsolat lezárása és egy ÚJ kapcsolat megnyitása, amin eltérő
// `serverInstanceId` jön. A `route.fulfill()` lezárt válasza egyiket sem tudja
// előállítani.
// ============================================================

interface RestartableStreamServer {
  readonly server: Server;
  /**
   * A szerver újraindulás szimulációja: minden nyitott kapcsolatot lezár, és
   * a böngésző következő kapcsolata már új `serverInstanceId` értéket kap,
   * feliratkozás NÉLKÜL: az `apps/server` a `serverInstanceId` értéket
   * induláskor generálja, a feliratkozásokat memóriában tartja, és ismeretlen
   * `streamId` értékre üres listát ad (`stream-registry/create-stream-registry.ts`
   * `getSubscriptions`), amit a kapcsolat első `stream_ready` kerete küld ki
   * (`stream-connection/handle-stream-connection.ts`).
   */
  readonly restart: () => void;
  readonly push: (frame: StreamFrame) => void;
}

/**
 * `GET /events` végpont, ami minden kapcsolaton az aktuális szerver példány
 * `stream_ready` keretét küldi, és a kapcsolatot nyitva hagyja. A rövid
 * `retry` azért kell, hogy a lezárás után a böngésző a natív
 * újracsatlakozással gyorsan visszatérjen (SPEC-005 5.7), a
 * `startLastEventIdServer` mintájára.
 */
function startRestartableStreamServer(): RestartableStreamServer {
  const openResponses = new Set<ServerResponse>();
  const instance = { index: 1 };

  const server = createServer((request: IncomingMessage, response: ServerResponse) => {
    if (request.url?.startsWith('/events') !== true) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, SSE_RESPONSE_HEADERS);
    openResponses.add(response);
    response.write('retry: 50\n\n');
    const readyFrame = streamReadyFrame(`s-${String(instance.index)}`, []);
    response.write(encodeStreamFrame(readyFrame));
  });
  server.listen(REAL_SERVER_PORT);

  return {
    server,
    restart: () => {
      instance.index += 1;
      for (const response of openResponses) {
        response.end();
      }
      openResponses.clear();
    },
    push: (frame) => {
      for (const response of openResponses) {
        response.write(encodeStreamFrame(frame));
      }
    },
  };
}

test('élő run_interrupted keretre (szabályos leállás) a fejléc átvált, és megjelenik az Újraindítás gomb', async ({
  page,
}) => {
  const streamServer = startOpenStreamServer([streamReadyFrame('s-1', [])]);
  serverHolder.current = streamServer.server;
  const state: RunViewMockState = { runStatus: 'running', stepRuns: [stepRun('running')] };
  await mockRunView(page, state);

  await page.goto('/run?runId=r-1');
  await expect(page.getByRole('button', { name: 'Megszakítás' })).toBeVisible();
  const node = nodeLocator(page, 'n1');
  await expect(node.getByText('fut', { exact: true })).toBeVisible();

  // A szerver a futást és a lépést ELŐBB viszi `interrupted` állapotba, és
  // csak utána adja ki élőben a keretet (SPEC-004 10.2 3. és 4. pont).
  state.runStatus = 'interrupted';
  state.stepRuns = [stepRun('interrupted')];
  streamServer.push({
    event: 'run_event',
    delivery: 'live',
    runEvent: makeRunEventRecord(9, 'r-1', { kind: 'run_interrupted', payload: { reason: 'graceful_shutdown' } }),
  });

  await expect(page.getByRole('button', { name: 'Újraindítás' })).toBeVisible();
  // `exact`: a név részszöveges illesztése a transcript panel soronkénti
  // fejléc gombjaira is ráillhetne.
  await expect(page.getByRole('button', { name: 'Megszakítás', exact: true })).toBeHidden();
  await expect(node.getByText('félbeszakítva', { exact: true })).toBeVisible();
});

test('szerver újraindulás után a futás nézet újra feliratkozik, újratölti a futást és a lépéseket, és az utána érkező élő keret frissíti a rajzot', async ({
  page,
}) => {
  const streamServer = startRestartableStreamServer();
  serverHolder.current = streamServer.server;
  const state: RunViewMockState = { runStatus: 'running', stepRuns: [stepRun('running')] };
  const calls = { subscriptions: 0, getRun: 0, listStepRuns: 0 };
  await installApiMocks(page, [
    mockRoute('getRun', async (route) => {
      calls.getRun += 1;
      await route.fulfill(jsonBody(runDetailWithStatus(state.runStatus)));
    }),
    mockRoute('readRunSnapshot', async (route) => route.fulfill(jsonBody(RUN_SNAPSHOT))),
    mockRoute('listStepRuns', async (route) => {
      calls.listStepRuns += 1;
      await route.fulfill(jsonBody(state.stepRuns));
    }),
    mockRoute('listPendingApprovals', async (route) => route.fulfill(jsonBody([]))),
    mockRoute('replaceStreamSubscriptions', async (route) => {
      calls.subscriptions += 1;
      await route.fulfill(jsonBody({ streamId: 'e2e-stream', subscriptions: [] }));
    }),
  ]);

  await page.goto('/run?runId=r-1');
  const node = nodeLocator(page, 'n1');
  await expect(node.getByText('fut', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Megszakítás' })).toBeVisible();
  await expect.poll(() => calls.subscriptions).toBe(1);
  expect(calls).toEqual({ subscriptions: 1, getRun: 1, listStepRuns: 1 });
  await setNoReloadMarker(page);

  // Az újraindult szerver indulási helyreállítása a futást és a nem
  // terminális lépést `interrupted` állapotba vitte, lépés szintű esemény
  // nélkül (SPEC-004 10.1), a feliratkozás pedig elveszett.
  state.runStatus = 'interrupted';
  state.stepRuns = [stepRun('interrupted')];
  streamServer.restart();

  await expect.poll(() => calls.subscriptions).toBe(2);
  await expect(node.getByText('félbeszakítva', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Újraindítás' })).toBeVisible();
  // A felület a válaszok tartalmát mutatja, tehát mindkét kezelő lefutott.
  expect(calls).toEqual({ subscriptions: 2, getRun: 2, listStepRuns: 2 });

  // Az új kapcsolat élő kerete eljut a nézetig, és a rajz frissül. A keret
  // tartalma szintetikus: azt méri, hogy az újracsatlakozás után a keret út
  // (feliratkozó, jelző szűrő, újratöltés) ép maradt.
  state.stepRuns = [stepRun('failed')];
  streamServer.push(stepEventFrame(10, 'step_finished', 'live'));
  await expect(node.getByText('sikertelen', { exact: true })).toBeVisible();
  expect(calls.listStepRuns).toBe(3);
  expect(await readNoReloadMarker(page)).toBe(true);
});

// ============================================================
// A SZERVER LEÁLLÁSA ALATT A FUTÁS NÉZET A HELYÉN MARAD (2026-09-23).
//
// A valódi `apps/server` elleni mérés: a szabályos leállás `run_interrupted`
// kerete még a NYITOTT SSE kapcsolaton érkezik, de a rá indított újratöltés
// a fejlesztői Vite proxytól 502-t kap (a backend már nem fogad kapcsolatot),
// és a teljes futás nézet helyén a "HTTP 502" riasztás állt az újraindulásig.
// A fenti 2. és 3. kivétel alá tartozik: menet közben beszúrt keret, utána a
// kapcsolat megszakadása és egy új példány. A leállás alatti állapot a valódi
// hálózati hiba: a port egy olyan TCP szerveré, ami minden kapcsolatot
// azonnal lezár, tehát a böngésző `EventSource`-a hálózati hibát kap, és a
// HTML szabvány szerint újra próbálkozik (nem zárja le a kapcsolatot).
// ============================================================

/**
 * A Vite fejlesztői proxy válasza, ha a backend nem fogad kapcsolatot: üres,
 * `text/plain` törzsű 502 (a telepített `vite` forrásának proxy `error`
 * eseménykezelője).
 */
const BAD_GATEWAY = { status: 502, contentType: 'text/plain', body: '' };

/**
 * Egy szerver példány `GET /events` végpontja: rövid `retry` (a böngésző a
 * megszakadás után gyorsan próbálkozzon újra, SPEC-005 5.7), a példány
 * `stream_ready` kerete, és nyitva hagyott kapcsolat, amibe menet közben
 * keret szúrható.
 */
function startStreamServerInstance(serverInstanceId: string): {
  readonly server: Server;
  readonly push: (frame: StreamFrame) => void;
  /**
   * Minden nyitott válasz szabályos lezárása: a már kiírt keretek kimennek,
   * a valódi szerver leállási sorrendje szerint (SPEC-006 8.2).
   */
  readonly endAll: () => void;
} {
  const openResponses = new Set<ServerResponse>();
  const server = createServer((request: IncomingMessage, response: ServerResponse) => {
    if (request.url?.startsWith('/events') !== true) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, SSE_RESPONSE_HEADERS);
    openResponses.add(response);
    response.write('retry: 50\n\n');
    response.write(encodeStreamFrame(streamReadyFrame(serverInstanceId, [])));
  });
  server.listen(REAL_SERVER_PORT);
  return {
    server,
    push: (frame) => {
      for (const response of openResponses) {
        response.write(encodeStreamFrame(frame));
      }
    },
    endAll: () => {
      for (const response of openResponses) {
        response.end();
      }
      openResponses.clear();
    },
  };
}

/**
 * A leállt szerver: a porton minden TCP kapcsolatot azonnal lezár, és
 * számolja a böngésző újracsatlakozási kísérleteit. A számláló a teszt
 * állapot alapú várakozásának jele (`expect.poll`), nem egy időzítő.
 */
function startDownServer(): { readonly server: NetServer; readonly attempts: { count: number } } {
  const attempts = { count: 0 };
  const server = createNetServer((socket) => {
    attempts.count += 1;
    socket.destroy();
  });
  server.listen(REAL_SERVER_PORT);
  return { server, attempts };
}

async function closeServer(server: NetServer): Promise<void> {
  await new Promise<void>((resolve) => {
    server.close(() => {
      resolve();
    });
  });
}

const downServerHolder: { current: NetServer | undefined } = { current: undefined };

test.afterEach(async () => {
  if (downServerHolder.current === undefined) {
    return;
  }
  await closeServer(downServerHolder.current);
  downServerHolder.current = undefined;
});

interface ShutdownMockState {
  down: boolean;
  runStatus: RunDetail['status'];
  stepRuns: readonly StepRunRecord[];
}

/**
 * A futás nézet REST mockjai, a leállás alatt (`down`) a Vite proxy 502
 * válaszával.
 */
async function mockRunViewWithShutdown(page: Page, state: ShutdownMockState): Promise<void> {
  await installApiMocks(page, [
    mockRoute('getRun', async (route) =>
      route.fulfill(state.down ? BAD_GATEWAY : jsonBody(runDetailWithStatus(state.runStatus))),
    ),
    mockRoute('readRunSnapshot', async (route) => route.fulfill(jsonBody(RUN_SNAPSHOT))),
    mockRoute('listStepRuns', async (route) => route.fulfill(state.down ? BAD_GATEWAY : jsonBody(state.stepRuns))),
    mockRoute('listPendingApprovals', async (route) => route.fulfill(state.down ? BAD_GATEWAY : jsonBody([]))),
    mockRoute('replaceStreamSubscriptions', async (route) =>
      route.fulfill(state.down ? BAD_GATEWAY : jsonBody({ streamId: 'e2e-stream', subscriptions: [] })),
    ),
  ]);
}

/**
 * A szabályos leállás a kliens felől: a REST már 502-t ad, a `run_interrupted`
 * kerete még élőben kimegy a nyitott kapcsolaton, UTÁNA a kapcsolat lezárul, és
 * a port a leállt szerveré lesz. Visszatér, amikor a böngésző legalább egyszer
 * sikertelenül próbált újracsatlakozni.
 */
async function shutDownStreamServer(
  instance: ReturnType<typeof startStreamServerInstance>,
  state: ShutdownMockState,
): Promise<{ readonly attempts: { count: number } }> {
  state.down = true;
  instance.push({
    event: 'run_event',
    delivery: 'live',
    runEvent: makeRunEventRecord(9, 'r-1', { kind: 'run_interrupted', payload: { reason: 'graceful_shutdown' } }),
  });
  instance.endAll();
  await closeServer(instance.server);
  serverHolder.current = undefined;
  const down = startDownServer();
  downServerHolder.current = down.server;
  await expect.poll(() => down.attempts.count).toBeGreaterThan(0);
  return down;
}

test('a szerver leállása alatt (502 az újratöltésre) a futás nézet az utolsó állapotot mutatja várakozás jelzéssel, és az újraindulás után helyreáll', async ({
  page,
}) => {
  const first = startStreamServerInstance('s-1');
  serverHolder.current = first.server;
  const state: ShutdownMockState = { down: false, runStatus: 'running', stepRuns: [stepRun('running')] };
  await mockRunViewWithShutdown(page, state);

  await page.goto('/run?runId=r-1');
  const node = nodeLocator(page, 'n1');
  await expect(node.getByText('fut', { exact: true })).toBeVisible();
  await expect(page.getByText('kapcsolódás', { exact: true })).toBeHidden();
  await setNoReloadMarker(page);

  await shutDownStreamServer(first, state);

  const serverWait = page.getByRole('status').filter({ hasText: 'Várakozás a szerverre' });
  await expect(serverWait).toBeVisible();
  await expect(serverWait).toContainText('A szerver hibás választ adott (HTTP 502).');
  await expect(page.getByText('újracsatlakozás', { exact: true })).toBeVisible();
  // Az utolsó ismert rajz, fejléc és transcript a helyén: a 502 NEM cserélte
  // le a nézetet.
  await expect(page.getByRole('alert').filter({ hasText: 'HTTP 502' })).toBeHidden();
  await expect(node.getByText('fut', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Megszakítás', exact: true })).toBeVisible();
  await expect(page.getByText('A futás a szerver leállása miatt félbeszakadt')).toBeVisible();

  // Újraindulás ugyanazon az adatbázison: a helyreállítás a futást és a
  // lépést `interrupted` állapotban hagyta, az új példány azonosítója más.
  state.down = false;
  state.runStatus = 'interrupted';
  state.stepRuns = [stepRun('interrupted')];
  if (downServerHolder.current !== undefined) {
    await closeServer(downServerHolder.current);
    downServerHolder.current = undefined;
  }
  serverHolder.current = startStreamServerInstance('s-2').server;

  await expect(node.getByText('félbeszakítva', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Újraindítás' })).toBeVisible();
  await expect(serverWait).toBeHidden();
  await expect(page.getByText('újracsatlakozás', { exact: true })).toBeHidden();
  expect(await readNoReloadMarker(page)).toBe(true);
});

test('ha a szerver nem jön vissza, a futás nézet több sikertelen újracsatlakozás után is kimondja a várakozást, nem válik csendessé', async ({
  page,
}) => {
  const first = startStreamServerInstance('s-1');
  serverHolder.current = first.server;
  const state: ShutdownMockState = { down: false, runStatus: 'running', stepRuns: [stepRun('running')] };
  await mockRunViewWithShutdown(page, state);

  await page.goto('/run?runId=r-1');
  const node = nodeLocator(page, 'n1');
  await expect(node.getByText('fut', { exact: true })).toBeVisible();
  await expect(page.getByText('kapcsolódás', { exact: true })).toBeHidden();

  const down = await shutDownStreamServer(first, state);
  const serverWait = page.getByRole('status').filter({ hasText: 'Várakozás a szerverre' });
  await expect(serverWait).toBeVisible();

  // A böngésző tovább próbálkozik (a HTML szabvány szerint hálózati hibára
  // újracsatlakozik): a számláló növekedése a jel, hogy idő telt el.
  const attemptsBefore = down.attempts.count;
  await expect.poll(() => down.attempts.count).toBeGreaterThanOrEqual(attemptsBefore + 3);

  await expect(serverWait).toBeVisible();
  await expect(serverWait).toContainText('a szerver újraindulása után a nézet magától frissül');
  await expect(page.getByText('újracsatlakozás', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: 'HTTP 502' })).toBeHidden();
  await expect(node.getByText('fut', { exact: true })).toBeVisible();
});

test('a futás előzmények listája run_event keretre akkor is újratölt, ha UGYANABBAN a löketben protocol_error követi', async ({
  page,
}) => {
  const streamServer = startOpenStreamServer([streamReadyFrame('s-1', [])]);
  serverHolder.current = streamServer.server;
  const listRunsCalls: { count: number } = { count: 0 };
  await installApiMocks(page, [
    mockRoute('listRuns', async (route) => {
      listRunsCalls.count += 1;
      await route.fulfill(jsonBody([RUN_PENDING]));
    }),
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([WORKFLOW]))),
    mockRoute('replaceStreamSubscriptions', async (route) =>
      route.fulfill(jsonBody({ streamId: 'e2e-stream', subscriptions: [] })),
    ),
  ]);

  await page.goto('/runs');
  await expect(page.getByRole('table', { name: 'Futások' })).toBeVisible();
  const callCountBeforeBatch = listRunsCalls.count;

  streamServer.pushBatch([
    { event: 'run_event', delivery: 'live', runEvent: makeRunEventRecord(7, 'r-1', { kind: 'run_started' }) },
    // eslint-disable-next-line unicorn/no-null -- a protocol_error `runId` mezője a dróton valódi `null`, kapcsolat szintű hibánál (SPEC-005 5.4)
    { event: 'protocol_error', code: 'invalid_request', message: 'hibás fejléc', runId: null },
  ]);

  await expect.poll(() => listRunsCalls.count).toBe(callCountBeforeBatch + 1);
});

// ============================================================
// A DELTA KAPCSOLÓ KÖVETKEZMÉNYE: AZ ÁTMENETI SOROK (T-009-26, SPEC-008 7.5,
// AC42, AC43).
//
// Az átmeneti (`run_event_transient`) keret definíció szerint mindig élő,
// tehát a valóságban a pótlás UTÁN, egy nyitva maradó kapcsolatba menet
// közben érkezik: ez a fenti 2. és 3. kivétel. A második teszt az 1.
// kivétel alá tartozik: az újracsatlakozás `Last-Event-ID` fejlécét méri.
// A futás rekordja `persistedStreamDeltas: false` (`runDetailWithStatus`).
// ============================================================

/**
 * Egy élő szöveg delta átmeneti kerete, pontosan abban az alakban, ahogy a
 * szerver a kikapcsolt delta kapcsolójú futásnál kiküldi
 * (`apps/server/src/engine-assembly/classify-published-event.ts`).
 */
function textDeltaTransientFrame(text: string): StreamFrame {
  return {
    event: 'run_event_transient',
    runId: 'r-1',
    stepRunId: 's-1',
    kind: 'sdk_stream_event',
    occurredAtMs: 20,
    payload: { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text } } },
  };
}

/**
 * A futás nézet transcript listája.
 */
function transcriptList(page: Page): Locator {
  return page.getByRole('list', { name: 'Futás eseményei' });
}

test('élő átmeneti keretek: megjelölt, nem tárolt sorok, két azonos tartalmú keret két sor, és az utánuk érkező tárolt sor nem vész el', async ({
  page,
}) => {
  const streamServer = startOpenStreamServer([streamReadyFrame('s-1', [])]);
  serverHolder.current = streamServer.server;
  await mockRunView(page, { runStatus: 'running', stepRuns: [stepRun('running')] });

  await page.goto('/run?runId=r-1');
  const list = transcriptList(page);
  streamServer.pushBatch([
    stepEventFrame(1, 'step_started', 'replayed'),
    { event: 'replay_complete', runId: 'r-1', throughEventId: 1 },
  ]);
  await expect(list.getByRole('listitem')).toHaveCount(1);
  // A fejléc mondata a futás `persistedStreamDeltas: false` értékéből.
  await expect(page.getByText(/részleges szöveg csak élőben látszik/)).toBeVisible();

  // MENET KÖZBEN, a nyitott kapcsolatba: két azonos tartalmú delta, majd egy
  // TÁROLT sor. Egy, az átmeneti soroktól lépő kurzor ezt a 2-es azonosítójú
  // sort csendben eldobná.
  streamServer.push(textDeltaTransientFrame('Helló'));
  streamServer.push(textDeltaTransientFrame('Helló'));
  streamServer.push(stepEventFrame(2, 'step_finished', 'live'));

  await expect(list.getByRole('listitem')).toHaveCount(4);
  const transientRows = list.getByRole('button', { name: /Streamelt részlet: Helló/ });
  await expect(transientRows).toHaveCount(2);
  const marks = list.getByText('Nem tárolt', { exact: true });
  await expect(marks).toHaveCount(2);
  const markList = await marks.all();
  for (const mark of markList) {
    await expect(mark).toBeVisible();
    await expect(mark).toHaveAttribute('title', /nem kerül tárolásra/);
  }
  const lastRow = list.getByRole('listitem').last();
  await expect(lastRow).toHaveAttribute('aria-posinset', '4');
  await expect(lastRow.getByRole('button', { name: /Lépés befejeződött/ })).toBeVisible();
  await expect(lastRow.getByText('Nem tárolt', { exact: true })).toHaveCount(0);
});

/**
 * `GET /events`, ami az első kapcsolaton a pótlást, két átmeneti keretet,
 * majd lezárást küld; a második kapcsolaton rögzíti a `Last-Event-ID`
 * fejlécet, és a tárolt sorok pótlását adja (az 1-es ismétlésként, a 2-es
 * újként), nyitva hagyva a kapcsolatot.
 */
function startTransientReconnectServer(capturedLastEventId: { value: string | undefined }): Server {
  let requestCount = 0;
  const server = createServer((request: IncomingMessage, response: ServerResponse) => {
    if (request.url?.startsWith('/events') !== true) {
      response.writeHead(404).end();
      return;
    }
    requestCount += 1;
    response.writeHead(200, SSE_RESPONSE_HEADERS);
    response.write(encodeStreamFrame(streamReadyFrame('s-1', [])));
    if (requestCount === 1) {
      response.write('retry: 50\n\n');
      response.write(encodeStreamFrame(stepEventFrame(1, 'step_started', 'replayed')));
      response.write(encodeStreamFrame({ event: 'replay_complete', runId: 'r-1', throughEventId: 1 }));
      response.write(encodeStreamFrame(textDeltaTransientFrame('a')));
      response.write(encodeStreamFrame(textDeltaTransientFrame('b')));
      response.end();
      return;
    }
    capturedLastEventId.value = readSingleHeaderValue(request.headers['last-event-id']);
    response.write(encodeStreamFrame(stepEventFrame(1, 'step_started', 'replayed')));
    response.write(encodeStreamFrame(stepEventFrame(2, 'step_finished', 'live')));
  });
  server.listen(REAL_SERVER_PORT);
  return server;
}

test('átmeneti keretek után az újracsatlakozás kurzora az utolsó TÁROLT esemény: a Last-Event-ID 1, az ismétlés eldobódik, a 2-es sor megjelenik', async ({
  page,
}) => {
  const capturedLastEventId: { value: string | undefined } = { value: undefined };
  serverHolder.current = startTransientReconnectServer(capturedLastEventId);
  await mockRunView(page, { runStatus: 'running', stepRuns: [stepRun('running')] });

  await page.goto('/run?runId=r-1');
  await expect.poll(() => capturedLastEventId.value).toBe('1');

  const list = transcriptList(page);
  // 1 (tárolt), a, b (átmeneti), 2 (tárolt): az 1-es ismétlése nem duplázódik.
  await expect(list.getByRole('listitem')).toHaveCount(4);
  await expect(list.getByText('Nem tárolt', { exact: true })).toHaveCount(2);
  await expect(list.getByRole('button', { name: /Lépés elindult/ })).toHaveCount(1);
  await expect(
    list
      .getByRole('listitem')
      .last()
      .getByRole('button', { name: /Lépés befejeződött/ }),
  ).toBeVisible();
});

// ============================================================
// A LISTA ALJA: AZ UTOLSÓ SOR TELJES EGÉSZÉBEN LÁTSZIK (2026-09-24).
//
// Két, egymástól független ok miatt nem látszott az utolsó sor alja
// (`docs/research/2026-09-23-transcript-panel-meresek.md` 13. szekció):
//   1. Az átmeneti sor egy pixellel magasabb a lista becslésénél
//      (`collapsed-transcript-row-height.ts`), és a `react-window@2.3.1` a
//      görgetés után nem igazít a mért magassághoz: az utolsó sor alja
//      lemaradt a lista aljától. Ezt a négy helyzet teszt fogja.
//   2. A transcript oldal burkolója a belső térközével a panelnél magasabb
//      volt, és a panel a lista alsó 16 pixelét levágta: ezt már a pótlás
//      utáni első állítás (`openFollowingTranscript`) fogja.
// A korábbi görgetés tesztek `toBeInViewport()` állítása a részleges
// láthatóságot is elfogadja (a `ratio` alapértéke 0), ezért ezek a tesztek
// a TELJES láthatóságot mérik: `toBeInViewport({ ratio: 1 })`, plusz az
// utolsó sor alsó éle és a lista látható alsó éle közti különbség.
//
// Az új sorok a pótlás után, a nyitva maradó kapcsolatba érkeznek: ez a fenti
// 2. és 3. kivétel.
// ============================================================

/**
 * A pótlás tárolt sorainak száma: elég ahhoz, hogy a lista görgethető legyen.
 */
const REPLAYED_ROW_COUNT = 20;

/**
 * Az utolsó sor alsó éle mínusz a lista látható alsó éle, pixelben:
 * pozitív érték esetén ennyi lóg ki az utolsó sorból a lista alján.
 * `undefined`, amíg a sor nincs kirajzolva.
 */
async function lastRowBottomOverflow(list: Locator, rowCount: number): Promise<number | undefined> {
  return list.evaluate((element, position) => {
    const row = element.querySelector(`[role="listitem"][aria-posinset="${CSS.escape(String(position))}"]`);
    if (row === null) {
      return;
    }
    const visibleBottom = element.getBoundingClientRect().top + element.clientTop + element.clientHeight;
    return row.getBoundingClientRect().bottom - visibleBottom;
  }, rowCount);
}

/**
 * Az utolsó sor teljes egészében látszik, és az alja a lista alján áll. A
 * 0,5 pixeles tűrés a user elfogadási kritériuma (2026-09-24).
 */
async function expectLastRowFullyVisibleAtBottom(list: Locator, rowCount: number): Promise<void> {
  const lastRow = list.locator(`[role="listitem"][aria-posinset="${String(rowCount)}"]`);
  await expect(lastRow).toBeInViewport({ ratio: 1 });
  await expect.poll(async () => Math.abs((await lastRowBottomOverflow(list, rowCount)) ?? Infinity)).toBeLessThan(0.5);
}

/**
 * A futás nézet megnyitása a pótlással; visszatér, amikor az utolsó tárolt
 * sor kirajzolódott, és a lista az alján áll.
 */
async function openFollowingTranscript(page: Page, theme: 'light' | 'dark'): Promise<OpenStreamServer> {
  const streamServer = startOpenStreamServer([streamReadyFrame('s-1', [])]);
  serverHolder.current = streamServer.server;
  await page.addInitScript((mode) => {
    globalThis.localStorage.setItem('eggTheme', mode);
  }, theme);
  await mockRunView(page, { runStatus: 'running', stepRuns: [stepRun('running')] });
  await page.goto('/run?runId=r-1');
  streamServer.pushBatch([
    ...Array.from({ length: REPLAYED_ROW_COUNT }, (_, index) => stepEventFrame(index + 1, 'step_started', 'replayed')),
    { event: 'replay_complete', runId: 'r-1', throughEventId: REPLAYED_ROW_COUNT },
  ]);
  await expectLastRowFullyVisibleAtBottom(transcriptList(page), REPLAYED_ROW_COUNT);
  return streamServer;
}

function transientFrames(count: number): readonly StreamFrame[] {
  return Array.from({ length: count }, (_, index) => textDeltaTransientFrame(`Részlet ${String(index + 1)}`));
}

for (const theme of ['light', 'dark'] as const) {
  test(`követés közben 3 átmeneti sor után az utolsó sor teljes egészében látszik, az alja a lista alján (${theme} téma)`, async ({
    page,
  }) => {
    const streamServer = await openFollowingTranscript(page, theme);
    streamServer.pushBatch(transientFrames(3));
    await expectLastRowFullyVisibleAtBottom(transcriptList(page), REPLAYED_ROW_COUNT + 3);
  });

  test(`követés közben egy 120 soros löket után az utolsó sor teljes egészében látszik (${theme} téma)`, async ({
    page,
  }) => {
    const streamServer = await openFollowingTranscript(page, theme);
    streamServer.pushBatch(transientFrames(120));
    await expectLastRowFullyVisibleAtBottom(transcriptList(page), REPLAYED_ROW_COUNT + 120);
  });

  test(`az ugrás az aljára gomb után az utolsó sor teljes egészében látszik (${theme} téma)`, async ({ page }) => {
    const streamServer = await openFollowingTranscript(page, theme);
    const list = transcriptList(page);
    await list.evaluate((element) => {
      element.scrollTo({ top: 0 });
    });
    await expect(list.locator('[role="listitem"][aria-posinset="1"]')).toBeInViewport({ ratio: 1 });
    streamServer.pushBatch(transientFrames(120));
    await page.getByRole('button', { name: 'Ugrás az aljára (120 új esemény)' }).click();
    await expectLastRowFullyVisibleAtBottom(list, REPLAYED_ROW_COUNT + 120);
  });

  test(`követés közben egyenként érkező átmeneti sorok után minden alkalommal az utolsó sor teljes egészében látszik (${theme} téma)`, async ({
    page,
  }) => {
    const streamServer = await openFollowingTranscript(page, theme);
    const list = transcriptList(page);
    for (let arrived = 1; arrived <= 5; arrived += 1) {
      streamServer.push(textDeltaTransientFrame(`Egyenként ${String(arrived)}`));
      await expectLastRowFullyVisibleAtBottom(list, REPLAYED_ROW_COUNT + arrived);
    }
  });
}
