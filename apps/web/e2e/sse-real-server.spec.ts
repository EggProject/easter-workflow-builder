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
// PÁRHUZAMOS FUTÁS. Minden teszt szervere az operációs rendszer által kiosztott
// szabad porton figyel, és a lap a build időben rögzített `VITE_STREAM_ORIGIN`
// felé induló `GET /events` kérését oda irányítja (`run-view-stream.ts`
// `attachStreamServer`). A korábbi, a rögzített portra kötődő, soros fájl
// `--repeat-each 3` mellett három workerrel `EADDRINUSE`-szal bukott.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { createServer as createNetServer, type Server as NetServer } from 'node:net';
import type {
  PendingApproval,
  RunDetail,
  RunEventKind,
  RunEventRecord,
  RunSummary,
  StepRunRecord,
  StreamFrame,
  WorkflowSummary,
} from '@easter-workflow-builder/protocol';
import { encodeStreamFrame } from '@easter-workflow-builder/protocol';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './coverage-fixture.ts';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';
import { makeRunEventRecord } from './transcript-fixture.ts';
import {
  attachStreamServer,
  captureEventSources,
  deliverFrameOnMeasuredCommit,
  deliverFrameWithNextClick,
  expectLastRowFullyVisibleAtBottom,
  headerOffsetInList,
  headerTopInViewport,
  installMeasuredCommitDelivery,
  lastRowBottomOverflow,
  listenOnLoopback,
  mockRunView,
  NO_STEP_RUNS,
  openFollowingTranscript,
  REPLAYED_ROW_COUNT,
  routeStreamToPort,
  RUN_SNAPSHOT,
  runDetailWithStatus,
  SSE_RESPONSE_HEADERS,
  startOpenStreamServer,
  stepEventFrame,
  stepRun,
  streamReadyFrame,
  TABBED_LAYOUT,
  textDeltaTransientFrame,
  transcriptList,
  transientFrames,
  WIDE_LAYOUT,
  type OpenStreamServer,
  type RunViewMockState,
  type TranscriptLayout,
} from './run-view-stream.ts';

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
   * A lapon belül KIADOTT `GET /api/approvals` kérések száma, ugyanabból az
   * okból a lapon belül számolva, mint az `e2eStepRunFetchCounter`.
   */
  var e2eApprovalFetchCounter: { count: number } | undefined;
  /**
   * A lap betöltése UTÁN beállított jelző: ha a lap újratöltődne, eltűnne.
   */
  var e2eNoReloadMarker: boolean | undefined;
}

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
async function startLastEventIdServer(page: Page, capturedLastEventId: { value: string | undefined }): Promise<Server> {
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
  await attachStreamServer(page, server);
  return server;
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
  // kapcsolat egyébként életben tartaná a szervert (és vele a portját) a
  // worker folyamat végéig.
  serverHolder.current?.closeAllConnections();
  serverHolder.current?.close();
  serverHolder.current = undefined;
});

test('a második SSE kapcsolat Last-Event-ID fejlécet küld, a szerver onnan folytat', async ({ page }) => {
  const capturedLastEventId: { value: string | undefined } = { value: undefined };
  serverHolder.current = await startLastEventIdServer(page, capturedLastEventId);

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
  const streamServer = await startOpenStreamServer(page, [streamReadyFrame('s-1', ['r-1'])]);
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
  const streamServer = await startOpenStreamServer(page, [streamReadyFrame('s-1', ['r-1'])]);
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

test('a megszakítás folyamatban állapotot a MENET KÖZBEN érkező run_finished keret zárja le', async ({ page }) => {
  const streamServer = await startOpenStreamServer(page, [streamReadyFrame('s-1', [])]);
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

for (const finished of [
  { status: 'succeeded', label: 'sikeres' },
  { status: 'failed', label: 'sikertelen' },
] as const) {
  test(`élő step_started keretre "fut", step_finished keretre "${finished.label}" jelvény a csomóponton, oldal újratöltés nélkül`, async ({
    page,
  }) => {
    const streamServer = await startOpenStreamServer(page, [streamReadyFrame('s-1', [])]);
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
  const streamServer = await startOpenStreamServer(page, [streamReadyFrame('s-1', ['r-1'])]);
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
  const streamServer = await startOpenStreamServer(page, [streamReadyFrame('s-1', [])]);
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
// A FÜGGŐ JÓVÁHAGYÁSOK ÉLŐ LISTÁJA (T-009-27, SPEC-008 8. szekció).
//
// A fenti 2. kivétel alá tartozik: a jelző keretek egy MÁR MEGNYITOTT
// kapcsolatba érkeznek menet közben. Az állapot forrása a `GET /api/approvals`
// válasza, a keret csak jelzés (`approval-prompt/is-approval-list-change-frame.ts`),
// ugyanúgy, mint a lépés futás listánál.
// ============================================================

/* eslint-disable unicorn/no-null -- lásd a fájl fejlécének eslint-disable indoklását */

const LIVE_APPROVAL: PendingApproval = {
  id: 'appr-live',
  runId: 'r-1',
  stepRunId: 's-1',
  title: 'Élőben érkező jóváhagyás',
  body: 'Kérlek erősítsd meg',
  payload: { amount: 1 },
  decision: null,
  requestedAtMs: 5,
  decidedAtMs: null,
};

/* eslint-enable unicorn/no-null */

test('élő approval_requested keretre a jóváhagyás panel oldal újratöltés nélkül megjelenik, approval_decided keretre eltűnik', async ({
  page,
}) => {
  const streamServer = await startOpenStreamServer(page, [streamReadyFrame('s-1', [])]);
  serverHolder.current = streamServer.server;
  const approvalsHolder: { current: readonly PendingApproval[] } = { current: [] };
  const approvalFetches = { count: 0 };
  await installApiMocks(page, [
    mockRoute('getRun', async (route) => route.fulfill(jsonBody(runDetailWithStatus('running')))),
    mockRoute('readRunSnapshot', async (route) => route.fulfill(jsonBody(RUN_SNAPSHOT))),
    mockRoute('listStepRuns', async (route) => route.fulfill(jsonBody(NO_STEP_RUNS))),
    mockRoute('listPendingApprovals', async (route) => {
      approvalFetches.count += 1;
      await route.fulfill(jsonBody(approvalsHolder.current));
    }),
    mockRoute('replaceStreamSubscriptions', async (route) =>
      route.fulfill(jsonBody({ streamId: 'e2e-stream', subscriptions: [] })),
    ),
  ]);

  await page.goto('/run?runId=r-1');
  await expect(page.getByRole('button', { name: 'Megszakítás' })).toBeVisible();
  await expect.poll(() => approvalFetches.count).toBe(1);
  const heading = page.getByRole('heading', { name: LIVE_APPROVAL.title });
  const headerBadge = page.locator('.run-control__bar').getByText('jóváhagyásra vár', { exact: true });
  await expect(heading).toHaveCount(0);
  await setNoReloadMarker(page);

  approvalsHolder.current = [LIVE_APPROVAL];
  streamServer.push(stepEventFrame(1, 'approval_requested', 'live'));
  await expect(heading).toBeVisible();
  await expect(headerBadge).toBeVisible();

  approvalsHolder.current = [];
  streamServer.push(stepEventFrame(2, 'approval_decided', 'live'));
  await expect(heading).toHaveCount(0);
  await expect(headerBadge).toHaveCount(0);

  expect(await readNoReloadMarker(page)).toBe(true);
});

/**
 * A kiadott `GET /api/approvals` kérések számlálója a lapon belül, a lap saját
 * `fetch` hívásába kötve, a betöltés ELŐTT (`installStepRunFetchCounter`
 * mintája). A számláló a kérés KIADÁSAKOR nő, szinkron: egy összevonás nélküli
 * kódon egy löket minden jelző kerete ugyanabban a feladatban indítaná a
 * kérését, tehát a számláló egyetlen lépésben ugrana a végértékre.
 */
async function installApprovalFetchCounter(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const originalFetch = globalThis.fetch.bind(globalThis);
    const counter = { count: 0 };
    Object.defineProperties(globalThis, {
      e2eApprovalFetchCounter: { configurable: true, value: counter },
      fetch: {
        configurable: true,
        writable: true,
        value: (...parameters: Parameters<typeof fetch>) => {
          const [input] = parameters;
          const url = input instanceof Request ? input.url : String(input);
          if (new URL(url).pathname.endsWith('/approvals')) {
            counter.count += 1;
          }
          return originalFetch(...parameters);
        },
      },
    });
  });
}

async function readApprovalFetchCount(page: Page): Promise<number | undefined> {
  return page.evaluate(() => globalThis.e2eApprovalFetchCounter?.count);
}

const BURST_APPROVAL_COUNT = 20;

test('egy löketben érkező 20 approval_requested keretre az újratöltés összevonva fut: a csatoláskori betöltésen felül egy folyamatban lévő és egy utólagos kérés, és a panel a végállapotot mutatja', async ({
  page,
}) => {
  const streamServer = await startOpenStreamServer(page, [streamReadyFrame('s-1', [])]);
  serverHolder.current = streamServer.server;
  const approvalsHolder: { current: readonly PendingApproval[] } = { current: [] };
  await installApiMocks(page, [
    mockRoute('getRun', async (route) => route.fulfill(jsonBody(runDetailWithStatus('running')))),
    mockRoute('readRunSnapshot', async (route) => route.fulfill(jsonBody(RUN_SNAPSHOT))),
    mockRoute('listStepRuns', async (route) => route.fulfill(jsonBody(NO_STEP_RUNS))),
    mockRoute('listPendingApprovals', async (route) => route.fulfill(jsonBody(approvalsHolder.current))),
    mockRoute('replaceStreamSubscriptions', async (route) =>
      route.fulfill(jsonBody({ streamId: 'e2e-stream', subscriptions: [] })),
    ),
  ]);
  await installApprovalFetchCounter(page);

  await page.goto('/run?runId=r-1');
  await expect(page.getByRole('button', { name: 'Megszakítás' })).toBeVisible();
  await expect.poll(async () => readApprovalFetchCount(page)).toBe(1);
  await setNoReloadMarker(page);

  // A szerver oldali állapot a löket UTÁN: húsz függő jóváhagyás, és a löket
  // húsz élő `approval_requested` kerete, EGY `write` hívásban.
  approvalsHolder.current = Array.from({ length: BURST_APPROVAL_COUNT }, (_, index) => ({
    ...LIVE_APPROVAL,
    id: `appr-burst-${String(index)}`,
    title: `Löketben érkező jóváhagyás ${String(index + 1)}`,
    requestedAtMs: LIVE_APPROVAL.requestedAtMs + index,
  }));
  streamServer.pushBatch(
    Array.from({ length: BURST_APPROVAL_COUNT }, (_, index) => stepEventFrame(index + 1, 'approval_requested', 'live')),
  );

  const lastPosition = page
    .getByRole('navigation', { name: 'Jóváhagyások lapozása' })
    .getByText(`1 / ${String(BURST_APPROVAL_COUNT)}`, { exact: true });
  await expect(lastPosition).toBeVisible();
  await expect(page.locator('.run-control__bar').getByText('jóváhagyásra vár', { exact: true })).toBeVisible();
  // `createCoalescedReload`: az első keret indít egy kérést, a futása alatt
  // érkező további tizenkilenc egyetlen utólagos kérésbe olvad. Összevonás
  // nélkül a számláló egy lépésben 1-ről 21-re ugrana, tehát a 3 sosem állna
  // elő.
  await expect.poll(async () => readApprovalFetchCount(page)).toBe(3);
  await expect(lastPosition).toBeVisible();
  expect(await readNoReloadMarker(page)).toBe(true);
});

/**
 * Három függő jóváhagyás, AZONOS címmel (egy `fan_out` csomópont ágai), a
 * `payload` szerint megkülönböztetve: a látott jóváhagyás kizárólag a
 * tartalmáról ismerhető fel.
 */
function selectionApproval(branch: string, requestedAtMs: number): PendingApproval {
  return {
    ...LIVE_APPROVAL,
    id: `appr-selection-${branch}`,
    title: 'Ág jóváhagyása',
    payload: { branch },
    requestedAtMs,
  };
}

test('élő frissítéskor a látott jóváhagyás nem ugrik el: egy előtte álló kikerülése és egy elé érkező új jóváhagyás után is ugyanaz látszik, csak a helye változik', async ({
  page,
}) => {
  const streamServer = await startOpenStreamServer(page, [streamReadyFrame('s-1', [])]);
  serverHolder.current = streamServer.server;
  const first = selectionApproval('A', 10);
  const second = selectionApproval('B', 20);
  const third = selectionApproval('C', 30);
  const approvalsHolder: { current: readonly PendingApproval[] } = { current: [first, second, third] };
  await installApiMocks(page, [
    mockRoute('getRun', async (route) => route.fulfill(jsonBody(runDetailWithStatus('running')))),
    mockRoute('readRunSnapshot', async (route) => route.fulfill(jsonBody(RUN_SNAPSHOT))),
    mockRoute('listStepRuns', async (route) => route.fulfill(jsonBody(NO_STEP_RUNS))),
    mockRoute('listPendingApprovals', async (route) => route.fulfill(jsonBody(approvalsHolder.current))),
    mockRoute('replaceStreamSubscriptions', async (route) =>
      route.fulfill(jsonBody({ streamId: 'e2e-stream', subscriptions: [] })),
    ),
  ]);

  await page.goto('/run?runId=r-1');
  const navigation = page.getByRole('navigation', { name: 'Jóváhagyások lapozása' });
  const region = page.getByRole('region', { name: 'Függő jóváhagyások' });
  await expect(navigation.getByText('1 / 3', { exact: true })).toBeVisible();
  await navigation.getByRole('button', { name: '2', exact: true }).click();
  await expect(navigation.getByText('2 / 3', { exact: true })).toBeVisible();
  await expect(region.getByText('"branch": "B"')).toBeVisible();
  await setNoReloadMarker(page);

  // Az előtte álló jóváhagyás döntés nélkül lezárul (például egy másik lapon
  // hozott döntés): a lista szűkül, a látott jóváhagyás marad.
  approvalsHolder.current = [second, third];
  streamServer.push(stepEventFrame(1, 'approval_decided', 'live'));
  await expect(navigation.getByText('1 / 2', { exact: true })).toBeVisible();
  await expect(region.getByText('"branch": "B"')).toBeVisible();

  // Egy korábbi időpontú jóváhagyás érkezik: a lista elé bővül, a látott
  // jóváhagyás marad, a helye nő.
  const earlier = selectionApproval('Z', 5);
  approvalsHolder.current = [earlier, second, third];
  streamServer.push(stepEventFrame(2, 'approval_requested', 'live'));
  await expect(navigation.getByText('2 / 3', { exact: true })).toBeVisible();
  await expect(region.getByText('"branch": "B"')).toBeVisible();

  expect(await readNoReloadMarker(page)).toBe(true);
});

/**
 * A lapozás NÉLKÜL, alapból látott jóváhagyás is azonnal rögzül
 * (`use-approval-selection.ts`): a user nem választott, mégis egy később
 * listázott, de KORÁBBI időpontú jóváhagyás nem veheti át a helyét a keze
 * alatt. A fenti teszt a lapozással választott jóváhagyást őrzi; ez a
 * rögzítés nélküli ág (a `setSelectedApprovalId` feltételes hívása
 * nélkül) kizárólag a legrégebbit mutatná, tehát a látott jóváhagyás itt
 * kicserélődne (független ellenőrzés 2026-09-25: e2e nem őrizte).
 */
test('élő frissítéskor a lapozás nélkül látott jóváhagyás is rögzül: egy elé érkező, korábbi időpontú jóváhagyás nem veszi át a helyét', async ({
  page,
}) => {
  const streamServer = await startOpenStreamServer(page, [streamReadyFrame('s-1', [])]);
  serverHolder.current = streamServer.server;
  const second = selectionApproval('B', 20);
  const third = selectionApproval('C', 30);
  const approvalsHolder: { current: readonly PendingApproval[] } = { current: [second, third] };
  await installApiMocks(page, [
    mockRoute('getRun', async (route) => route.fulfill(jsonBody(runDetailWithStatus('running')))),
    mockRoute('readRunSnapshot', async (route) => route.fulfill(jsonBody(RUN_SNAPSHOT))),
    mockRoute('listStepRuns', async (route) => route.fulfill(jsonBody(NO_STEP_RUNS))),
    mockRoute('listPendingApprovals', async (route) => route.fulfill(jsonBody(approvalsHolder.current))),
    mockRoute('replaceStreamSubscriptions', async (route) =>
      route.fulfill(jsonBody({ streamId: 'e2e-stream', subscriptions: [] })),
    ),
  ]);

  await page.goto('/run?runId=r-1');
  const navigation = page.getByRole('navigation', { name: 'Jóváhagyások lapozása' });
  const region = page.getByRole('region', { name: 'Függő jóváhagyások' });
  // A user nem lapoz: alapból a legrégebbi látszik.
  await expect(navigation.getByText('1 / 2', { exact: true })).toBeVisible();
  await expect(region.getByText('"branch": "B"')).toBeVisible();
  await setNoReloadMarker(page);

  const earlier = selectionApproval('Z', 5);
  approvalsHolder.current = [earlier, second, third];
  streamServer.push(stepEventFrame(1, 'approval_requested', 'live'));
  await expect(navigation.getByText('2 / 3', { exact: true })).toBeVisible();
  await expect(region.getByText('"branch": "B"')).toBeVisible();
  await expect(region.getByText('"branch": "Z"')).toHaveCount(0);

  expect(await readNoReloadMarker(page)).toBe(true);
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
async function startRestartableStreamServer(page: Page): Promise<RestartableStreamServer> {
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
  await attachStreamServer(page, server);

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
  const streamServer = await startOpenStreamServer(page, [streamReadyFrame('s-1', [])]);
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
  const streamServer = await startRestartableStreamServer(page);
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
 * keret szúrható. Alapból szabad porton indul; az újraindult példány a
 * leállt példány portját kapja (`port`), ugyanúgy, mint a valódi szerver.
 */
async function startStreamServerInstance(
  serverInstanceId: string,
  port = 0,
): Promise<{
  readonly server: Server;
  readonly port: number;
  readonly push: (frame: StreamFrame) => void;
  /**
   * Minden nyitott válasz szabályos lezárása: a már kiírt keretek kimennek,
   * a valódi szerver leállási sorrendje szerint (SPEC-006 8.2).
   */
  readonly endAll: () => void;
}> {
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
  const boundPort = await listenOnLoopback(server, port);
  return {
    server,
    port: boundPort,
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
 * A leállt szerver: a leállt példány portján minden TCP kapcsolatot azonnal
 * lezár, és számolja a böngésző újracsatlakozási kísérleteit. A számláló a
 * teszt állapot alapú várakozásának jele (`expect.poll`), nem egy időzítő.
 */
async function startDownServer(
  port: number,
): Promise<{ readonly server: NetServer; readonly attempts: { count: number } }> {
  const attempts = { count: 0 };
  const server = createNetServer((socket) => {
    attempts.count += 1;
    socket.destroy();
  });
  await listenOnLoopback(server, port);
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
  instance: Awaited<ReturnType<typeof startStreamServerInstance>>,
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
  const down = await startDownServer(instance.port);
  downServerHolder.current = down.server;
  await expect.poll(() => down.attempts.count).toBeGreaterThan(0);
  return down;
}

test('a szerver leállása alatt (502 az újratöltésre) a futás nézet az utolsó állapotot mutatja várakozás jelzéssel, és az újraindulás után helyreáll', async ({
  page,
}) => {
  const first = await startStreamServerInstance('s-1');
  serverHolder.current = first.server;
  await routeStreamToPort(page, first.port);
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
  const restarted = await startStreamServerInstance('s-2', first.port);
  serverHolder.current = restarted.server;

  await expect(node.getByText('félbeszakítva', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Újraindítás' })).toBeVisible();
  await expect(serverWait).toBeHidden();
  await expect(page.getByText('újracsatlakozás', { exact: true })).toBeHidden();
  expect(await readNoReloadMarker(page)).toBe(true);
});

test('ha a szerver nem jön vissza, a futás nézet több sikertelen újracsatlakozás után is kimondja a várakozást, nem válik csendessé', async ({
  page,
}) => {
  const first = await startStreamServerInstance('s-1');
  serverHolder.current = first.server;
  await routeStreamToPort(page, first.port);
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
  const streamServer = await startOpenStreamServer(page, [streamReadyFrame('s-1', [])]);
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

test('élő átmeneti keretek: megjelölt, nem tárolt sorok, két azonos tartalmú keret két sor, és az utánuk érkező tárolt sor nem vész el', async ({
  page,
}) => {
  const streamServer = await startOpenStreamServer(page, [streamReadyFrame('s-1', [])]);
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
async function startTransientReconnectServer(
  page: Page,
  capturedLastEventId: { value: string | undefined },
): Promise<Server> {
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
  await attachStreamServer(page, server);
  return server;
}

test('átmeneti keretek után az újracsatlakozás kurzora az utolsó TÁROLT esemény: a Last-Event-ID 1, az ismétlés eldobódik, a 2-es sor megjelenik', async ({
  page,
}) => {
  const capturedLastEventId: { value: string | undefined } = { value: undefined };
  serverHolder.current = await startTransientReconnectServer(page, capturedLastEventId);
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
//   1. Az átmeneti sor egy pixellel magasabb volt a lista becslésénél (a
//      "Nem tárolt" jelvény túlnőtt a sordobozon), és a `react-window@2.3.1`
//      a görgetés után nem igazít a mért magassághoz: az utolsó sor alja
//      lemaradt a lista aljától. Ma minden összecsukott sor egyforma magas
//      (`run-event-row.css`, research 16. szekció); ha valami újra eltérő
//      magasságú sort okozna, ezt a négy helyzet teszt fogja.
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

for (const theme of ['light', 'dark'] as const) {
  test(`követés közben 3 átmeneti sor után az utolsó sor teljes egészében látszik, az alja a lista alján (${theme} téma)`, async ({
    page,
  }) => {
    const streamServer = await openFollowingTranscript(page, theme, serverHolder);
    streamServer.pushBatch(transientFrames(3));
    await expectLastRowFullyVisibleAtBottom(transcriptList(page), REPLAYED_ROW_COUNT + 3);
  });

  test(`követés közben egy 120 soros löket után az utolsó sor teljes egészében látszik (${theme} téma)`, async ({
    page,
  }) => {
    const streamServer = await openFollowingTranscript(page, theme, serverHolder);
    streamServer.pushBatch(transientFrames(120));
    await expectLastRowFullyVisibleAtBottom(transcriptList(page), REPLAYED_ROW_COUNT + 120);
  });

  test(`az ugrás az aljára gomb után az utolsó sor teljes egészében látszik (${theme} téma)`, async ({ page }) => {
    const streamServer = await openFollowingTranscript(page, theme, serverHolder);
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
    const streamServer = await openFollowingTranscript(page, theme, serverHolder);
    const list = transcriptList(page);
    for (let arrived = 1; arrived <= 5; arrived += 1) {
      streamServer.push(textDeltaTransientFrame(`Egyenként ${String(arrived)}`));
      await expectLastRowFullyVisibleAtBottom(list, REPLAYED_ROW_COUNT + arrived);
    }
  });
}

// ============================================================
// AZ ÁTMENETI SOR UGYANOLYAN MAGAS, MINT A TÁROLT (2026-09-24).
//
// A "Nem tárolt" jelvény 22 pixeles, a sor szövege 21 pixeles; a sor fejléce
// ezért pontosan egy szövegsor magas (`run-event-row.css`), és a jelvény a
// belső margóba nyúlik. Ha a jelvény újra növelné a sort, a lista becslése az
// átmeneti sorokra pontatlan lenne, és az aljára görgetés lemaradna (research
// 13. és 16. szekció).
// ============================================================

test('az átmeneti sor ("Nem tárolt" jelvénnyel) pontosan olyan magas, mint a tárolt sor, és a jelvény teljes egészében a sorban áll', async ({
  page,
}) => {
  const streamServer = await openFollowingTranscript(page, 'light', serverHolder);
  streamServer.pushBatch(transientFrames(3));
  const list = transcriptList(page);
  await expectLastRowFullyVisibleAtBottom(list, REPLAYED_ROW_COUNT + 3);
  await page.evaluate(async () => {
    await globalThis.document.fonts.ready;
  });

  const rows = await list.getByRole('listitem').evaluateAll((items) =>
    items.map((item) => {
      const itemBox = item.getBoundingClientRect();
      const badge = item.querySelector('.badge');
      const badgeBox = badge?.getBoundingClientRect();
      return {
        height: itemBox.height,
        badgeInside:
          badgeBox === undefined ? undefined : badgeBox.top >= itemBox.top && badgeBox.bottom <= itemBox.bottom,
      };
    }),
  );
  const transientRows = rows.filter((row) => row.badgeInside !== undefined);
  const storedRows = rows.filter((row) => row.badgeInside === undefined);
  expect(transientRows.length).toBeGreaterThan(0);
  expect(storedRows.length).toBeGreaterThan(0);
  expect(new Set(rows.map((row) => row.height))).toStrictEqual(new Set([storedRows[0]?.height]));
  expect(transientRows.every((row) => row.badgeInside === true)).toBe(true);
});

// ============================================================
// A KINYITOTT SOR A HELYÉN MARAD ÉLŐ STREAM KÖZBEN (2026-09-24).
//
// A kinyitott sor új magassága a DOM-ban azonnal áll, a lista viszont csak a
// következő mérés után számol vele: a kinyitás és a mérés között érkező sor
// követése a kinyitott sort elrántaná (`use-transcript-auto-scroll.ts`,
// `docs/research/2026-09-23-transcript-panel-meresek.md` 15. és 16.
// szekció). A négy kinyitási út (egér, `Space` a `keydown` és a `keyup` között
// érkező sorral, `Enter`, csak `click`) mindegyikén a kinyitott sor fejléce
// a lista tetejéhez mérve nem mozdulhat, és az "Ugrás az aljára" gomb a
// kinyitás óta érkezett sorokat nevezi meg. A fejléc helye itt a lista
// eleméhez mért; hogy maga a lista sem mozdul a gomb megjelenésekor (a gomb
// helye előre fenntartva), azt "AZ UGRÁS GOMB MEGJELENÉSE" blokk méri az
// ablakban.
//
// DETERMINISZTIKUS VERSENY. A hálózaton érkező keret a kattintás és a mérés
// közé nem időzíthető megbízhatóan (research 16. szekció: a kinyitás utáni
// azonnali küldésre a követés kikapcsolása NÉLKÜL is csak a futások egy része
// bukott). Ezért az egyik új sor a kattintás capture fázisában, a valódi
// `EventSource` példányon kiváltott üzenetként érkezik: ugyanazon a
// feldolgozó úton megy, mint a hálózati keret, és garantáltan a mérés előtt
// kerül commitba. A csak `click` úton a kinyitással EGY commitba; egér,
// `Space` és `Enter` úton a hook kattintás figyelője utáni első commitba, a
// kinyitás commitja ELŐTT (mérve, `apps/web/measurement/transcript-scroll.ts`
// `render-sorrend` jelenete, research 17. szekció). A kapcsolat maga a
// `node:http` teszt szerveren nyitott.
//
// Az egér út `page.mouse`, nem `locator.click()`: az utóbbi a kattintás
// előtt maga is görgethet.
// ============================================================

/**
 * A kinyitás előtt érkező átmeneti sorok száma: a lista görgethető, és az
 * alján átmeneti sor áll.
 */
const TRANSIENT_BEFORE_EXPAND = 10;

/**
 * A lista az alján áll, az utolsó előtti sor a kinyitás célja: a kinyitott
 * törzs az utolsó sort a lista alja alá tolja. A következő kattintással egy
 * új sor is érkezik.
 */
async function openExpandTarget(
  page: Page,
  theme: 'light' | 'dark',
): Promise<{ readonly streamServer: OpenStreamServer; readonly list: Locator; readonly position: number }> {
  await captureEventSources(page);
  const streamServer = await openFollowingTranscript(page, theme, serverHolder);
  const list = transcriptList(page);
  streamServer.pushBatch(transientFrames(TRANSIENT_BEFORE_EXPAND));
  const rowCount = REPLAYED_ROW_COUNT + TRANSIENT_BEFORE_EXPAND;
  await expectLastRowFullyVisibleAtBottom(list, rowCount);
  await deliverFrameWithNextClick(page, textDeltaTransientFrame('A kattintással egy feladatban'));
  return { streamServer, list, position: rowCount - 1 };
}

function expandTargetHeader(expanded: Readonly<{ list: Locator; position: number }>): Locator {
  return expanded.list.locator(`[role="listitem"][aria-posinset="${String(expanded.position)}"]`).getByRole('button');
}

/**
 * A kinyitás utáni állítás: a sor nyitva, és a kattintással érkezett sor
 * után egy újabb sor is érkezik; az "Ugrás az aljára" gomb mindkettőt
 * megnevezi, és a fejléc a lista tetejéhez mérve pontosan ott áll, ahol a
 * kinyitás előtt.
 */
async function expectExpandedRowInPlace(
  page: Page,
  expanded: Readonly<{ streamServer: OpenStreamServer; list: Locator; position: number }>,
  offsetBefore: number | undefined,
): Promise<void> {
  const { streamServer, list, position } = expanded;
  expect(offsetBefore).toStrictEqual(expect.any(Number));
  await expect(expandTargetHeader(expanded)).toHaveAttribute('aria-expanded', 'true');
  streamServer.push(textDeltaTransientFrame('Kinyitás után'));
  await expect(page.getByRole('button', { name: 'Ugrás az aljára (2 új esemény)' })).toBeVisible();
  expect(await headerOffsetInList(list, position)).toBe(offsetBefore);
}

for (const theme of ['light', 'dark'] as const) {
  test(`követés közben egérrel kinyitott sor a helyén marad, és a követés kikapcsol (${theme} téma)`, async ({
    page,
  }) => {
    const expanded = await openExpandTarget(page, theme);
    const offsetBefore = await headerOffsetInList(expanded.list, expanded.position);
    const center = await expandTargetHeader(expanded).evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    });
    await page.mouse.click(center.x, center.y);
    await expectExpandedRowInPlace(page, expanded, offsetBefore);

    // A kinyitott törzsbe kattintás (például szöveg kijelölése közben) nem
    // fejléc: nem vált sort, és a követést sem kapcsolja vissza. A törzs a
    // lista alja alatt áll, ezért előbb a lista görgetésével látható lesz.
    const region = expanded.list
      .locator(`[role="listitem"][aria-posinset="${String(expanded.position)}"]`)
      .getByRole('region');
    await region.scrollIntoViewIfNeeded();
    const bodyPoint = await region.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + Math.min(rect.height / 2, 10);
      return { x, y, isOnBody: element.contains(globalThis.document.elementFromPoint(x, y)) };
    });
    expect(bodyPoint.isOnBody).toBe(true);
    await page.mouse.click(bodyPoint.x, bodyPoint.y);
    expanded.streamServer.push(textDeltaTransientFrame('Törzsbe kattintás után'));
    await expect(page.getByRole('button', { name: 'Ugrás az aljára (3 új esemény)' })).toBeVisible();
    await expect(expandTargetHeader(expanded)).toHaveAttribute('aria-expanded', 'true');
  });

  test(`követés közben Space-szel kinyitott sor a helyén marad akkor is, ha a keydown és a keyup között új sor érkezik (${theme} téma)`, async ({
    page,
  }) => {
    const expanded = await openExpandTarget(page, theme);
    await expandTargetHeader(expanded).focus();
    await page.keyboard.down('Space');
    // A `keydown` után, a `keyup` előtt érkező sort a lista még követi: a
    // sor ekkor még nincs kinyitva.
    expanded.streamServer.push(textDeltaTransientFrame('Space közben'));
    await expectLastRowFullyVisibleAtBottom(expanded.list, REPLAYED_ROW_COUNT + TRANSIENT_BEFORE_EXPAND + 1);
    const offsetBefore = await headerOffsetInList(expanded.list, expanded.position);
    await page.keyboard.up('Space');
    await expectExpandedRowInPlace(page, expanded, offsetBefore);
  });

  test(`követés közben Enterrel kinyitott sor a helyén marad (${theme} téma)`, async ({ page }) => {
    const expanded = await openExpandTarget(page, theme);
    await expandTargetHeader(expanded).focus();
    const offsetBefore = await headerOffsetInList(expanded.list, expanded.position);
    await page.keyboard.press('Enter');
    await expectExpandedRowInPlace(page, expanded, offsetBefore);
  });

  test(`követés közben csak click eseménnyel (pointer és billentyű nélkül) kinyitott sor a helyén marad (${theme} téma)`, async ({
    page,
  }) => {
    const expanded = await openExpandTarget(page, theme);
    const offsetBefore = await headerOffsetInList(expanded.list, expanded.position);
    // A Playwright doksi szerint ez az `element.click()` megfelelője.
    await expandTargetHeader(expanded).dispatchEvent('click');
    await expectExpandedRowInPlace(page, expanded, offsetBefore);
  });
}

// ============================================================
// KI-BE CSUKÁS UTÁN A KÖVETÉS FOLYTATÓDIK (2026-09-24).
//
// A `d598677` hookja egy képkockán belüli ki-be csukás (dupla kattintás,
// kétszeri `element.click()`) után végleg megállt: a sor magassága nem
// változott, mérés nem jött, a várakozás sosem zárult le, és a visszatartott
// effekt az új sorok számlálását is kihagyta (nem követett, gomb sem jelent
// meg). Ki-be csukás után a sor ugyanaz, tehát a követés folytatódik: minden
// új TÁROLT sor után az utolsó sor teljes egészében a lista alján áll
// (research 16. szekció).
// ============================================================

/**
 * A pótlás egyik (nem utolsó) tárolt sorának fejléce.
 */
function storedRowHeader(page: Page): Locator {
  return transcriptList(page)
    .locator(`[role="listitem"][aria-posinset="${String(REPLAYED_ROW_COUNT - 2)}"]`)
    .getByRole('button');
}

async function expectFollowingAfterStoredArrivals(page: Page, streamServer: OpenStreamServer): Promise<void> {
  const list = transcriptList(page);
  await expect(storedRowHeader(page)).toHaveAttribute('aria-expanded', 'false');
  for (let arrived = 1; arrived <= 5; arrived += 1) {
    streamServer.push(stepEventFrame(REPLAYED_ROW_COUNT + arrived, 'step_started', 'live'));
    await expectLastRowFullyVisibleAtBottom(list, REPLAYED_ROW_COUNT + arrived);
  }
  await expect(page.getByRole('button', { name: /Ugrás az aljára/ })).toHaveCount(0);
}

for (const theme of ['light', 'dark'] as const) {
  test(`dupla kattintás (dblclick) egy tárolt sor fejlécén után a követés folytatódik (${theme} téma)`, async ({
    page,
  }) => {
    const streamServer = await openFollowingTranscript(page, theme, serverHolder);
    await storedRowHeader(page).dblclick();
    await expectFollowingAfterStoredArrivals(page, streamServer);
  });

  test(`két click egy képkockán belül egy tárolt sor fejlécén után a követés folytatódik (${theme} téma)`, async ({
    page,
  }) => {
    const streamServer = await openFollowingTranscript(page, theme, serverHolder);
    // Egyetlen szkript futásban, tehát a kettő között nincs renderelés.
    await storedRowHeader(page).evaluate((element: HTMLElement) => {
      element.click();
      element.click();
    });
    await expectFollowingAfterStoredArrivals(page, streamServer);
  });
}

// ============================================================
// A VÁRAKOZÁS KILÉPÉSEI (2026-09-25).
//
// Egy sor kinyitása szünetelteti a követést (`use-transcript-auto-scroll.ts`).
// A szünetnek négy kilépése van: a mérés (csak becsukásnál, user döntés
// 2026-09-25), a páros kattintás, az "ugrás az aljára" gomb és a kézi
// visszatérés az aljára (user döntés 2026-09-24). A fenti tesztek a kinyitott
// sor helyét védik, ezek a kilépéseket: egy kilépés nélkül maradt szünet után
// a lista végleg nem követ. A mérés hiányát a fülváltás állítja elő: a rejtett
// sor 0 magasságát a `react-window` nem tárolja, és a sor a mérése előtt
// leszerelődik (`docs/research/2026-09-23-transcript-panel-meresek.md` 17.
// szekció).
// ============================================================

/**
 * Megvárja, hogy a lista a sor MÉRT magasságával számoljon: a következő sor
 * teteje (az utolsó sornál a `react-window` méretező eleme, a lista utolsó,
 * `aria-hidden` gyereke) a sor alsó élénél áll. A mérés előtt a lista még a
 * becsült magassággal pozicionál, tehát a kinyitott sor rálóg a következőre.
 */
async function waitForRowMeasured(list: Locator, position: number): Promise<void> {
  await expect
    .poll(async () =>
      list.evaluate((element, rowPosition) => {
        const row = element.querySelector(`[role="listitem"][aria-posinset="${CSS.escape(String(rowPosition))}"]`);
        const next = element.querySelector(`[role="listitem"][aria-posinset="${CSS.escape(String(rowPosition + 1))}"]`);
        const sizer = element.querySelector(':scope > [aria-hidden="true"]');
        if (row === null || sizer === null) {
          return Infinity;
        }
        const rowBottom = row.getBoundingClientRect().bottom;
        const followingTop = next === null ? sizer.getBoundingClientRect().bottom : next.getBoundingClientRect().top;
        return Math.abs(followingTop - rowBottom);
      }, position),
    )
    .toBeLessThan(0.5);
}

function jumpButton(page: Page): Locator {
  return page.getByRole('button', { name: /Ugrás az aljára/ });
}

/**
 * Kézi görgetés a lista aljára egérkerékkel, a lista fölött.
 */
async function wheelToBottom(page: Page, list: Locator): Promise<void> {
  await list.hover();
  await page.mouse.wheel(0, 100_000);
}

async function wheelToTop(page: Page, list: Locator): Promise<void> {
  await list.hover();
  await page.mouse.wheel(0, -100_000);
}

/**
 * Minden új sor után az utolsó sor teljes egészében a lista alján áll, és
 * nincs "ugrás az aljára" gomb: a lista követ.
 */
async function expectFollowingAfterArrivals(
  page: Page,
  streamServer: OpenStreamServer,
  list: Locator,
  rowCount: number,
): Promise<number> {
  let count = rowCount;
  for (let arrived = 1; arrived <= 3; arrived += 1) {
    streamServer.push(textDeltaTransientFrame(`Követés ${String(arrived)}`));
    count += 1;
    await expectLastRowFullyVisibleAtBottom(list, count);
  }
  await expect(jumpButton(page)).toHaveCount(0);
  return count;
}

/**
 * 375 pixelen, az alján állva: a végétől második sor kinyitása és a "Gráf"
 * fülre váltás EGY feladatban (egy szkript futásban), majd a rejtett fül
 * alatt három új sor, végül vissza a transcript fülre. A kinyitott sor a
 * mérése előtt leszerelődik, tehát a mérés sosem jön: a várakozás csak a
 * másik két kilépéssel zárulhat.
 */
async function pauseWithoutMeasurement(
  page: Page,
  theme: 'light' | 'dark',
): Promise<{ readonly streamServer: OpenStreamServer; readonly list: Locator; readonly rowCount: number }> {
  const streamServer = await openFollowingTranscript(page, theme, serverHolder, TABBED_LAYOUT);
  const list = transcriptList(page);
  streamServer.pushBatch(transientFrames(TRANSIENT_BEFORE_EXPAND));
  const bottomCount = REPLAYED_ROW_COUNT + TRANSIENT_BEFORE_EXPAND;
  await expectLastRowFullyVisibleAtBottom(list, bottomCount);
  await list.evaluate((element, position) => {
    const header = element.querySelector(
      `[role="listitem"][aria-posinset="${CSS.escape(String(position))}"] [aria-expanded]`,
    );
    const graphTab = [...globalThis.document.querySelectorAll('[role="tab"]')].find(
      (tab) => tab.textContent === 'Gráf',
    );
    if (!(header instanceof HTMLElement) || !(graphTab instanceof HTMLElement)) {
      throw new TypeError('a fejléc vagy a Gráf fül nem található');
    }
    header.click();
    graphTab.click();
  }, bottomCount - 1);
  await expect(page.getByRole('tab', { name: 'Gráf' })).toHaveAttribute('aria-selected', 'true');
  streamServer.pushBatch(transientFrames(3));
  const rowCount = bottomCount + 3;
  await page.getByRole('tab', { name: 'Transcript' }).click();
  await expect(page.getByRole('button', { name: 'Ugrás az aljára (3 új esemény)' })).toBeVisible();
  return { streamServer, list, rowCount };
}

for (const theme of ['light', 'dark'] as const) {
  test(`375 pixelen a kinyitással egy feladatban váltott fül után a kézi görgetés az aljára visszakapcsolja a követést (${theme} téma)`, async ({
    page,
  }) => {
    const { streamServer, list, rowCount } = await pauseWithoutMeasurement(page, theme);
    await wheelToBottom(page, list);
    await expectLastRowFullyVisibleAtBottom(list, rowCount);
    await expect(jumpButton(page)).toHaveCount(0);
    await expectFollowingAfterArrivals(page, streamServer, list, rowCount);
  });

  test(`a mérés nélkül maradt várakozást az ugrás gomb lezárja, és utána a kézi görgetés is visszakapcsol (${theme} téma)`, async ({
    page,
  }) => {
    const { streamServer, list, rowCount } = await pauseWithoutMeasurement(page, theme);
    await page.getByRole('button', { name: 'Ugrás az aljára (3 új esemény)' }).click();
    await expectLastRowFullyVisibleAtBottom(list, rowCount);
    let count = await expectFollowingAfterArrivals(page, streamServer, list, rowCount);

    // Az ugrás után a várakozás lezárult: felgörgetés, új sor, majd kézzel
    // vissza az aljára, és a lista újra követ.
    await wheelToTop(page, list);
    await expect(list.locator('[role="listitem"][aria-posinset="1"]')).toBeInViewport({ ratio: 1 });
    streamServer.push(textDeltaTransientFrame('Felgörgetve'));
    count += 1;
    await expect(page.getByRole('button', { name: 'Ugrás az aljára (1 új esemény)' })).toBeVisible();
    await wheelToBottom(page, list);
    await expectLastRowFullyVisibleAtBottom(list, count);
    await expect(jumpButton(page)).toHaveCount(0);
    await expectFollowingAfterArrivals(page, streamServer, list, count);
  });

  test(`a mérés után a kinyitott sor a helyén marad, és a kézi görgetés az aljára visszakapcsolja a követést (${theme} téma)`, async ({
    page,
  }) => {
    const streamServer = await openFollowingTranscript(page, theme, serverHolder);
    const list = transcriptList(page);
    streamServer.pushBatch(transientFrames(TRANSIENT_BEFORE_EXPAND));
    const rowCount = REPLAYED_ROW_COUNT + TRANSIENT_BEFORE_EXPAND;
    await expectLastRowFullyVisibleAtBottom(list, rowCount);
    const position = rowCount - 1;
    const header = list.locator(`[role="listitem"][aria-posinset="${String(position)}"]`).getByRole('button');
    const offsetBefore = await headerOffsetInList(list, position);

    await header.dispatchEvent('click');
    await expect(header).toHaveAttribute('aria-expanded', 'true');
    await waitForRowMeasured(list, position);
    streamServer.push(textDeltaTransientFrame('A mérés után'));
    await expect(page.getByRole('button', { name: 'Ugrás az aljára (1 új esemény)' })).toBeVisible();
    expect(await headerOffsetInList(list, position)).toBe(offsetBefore);

    await wheelToBottom(page, list);
    await expectLastRowFullyVisibleAtBottom(list, rowCount + 1);
    await expect(jumpButton(page)).toHaveCount(0);
    await expectFollowingAfterArrivals(page, streamServer, list, rowCount + 1);
  });

  test(`a kattintás utáni, a mérés előtti feladatban érkező sor nem görget (${theme} téma)`, async ({ page }) => {
    await captureEventSources(page);
    const streamServer = await openFollowingTranscript(page, theme, serverHolder);
    const list = transcriptList(page);
    streamServer.pushBatch(transientFrames(TRANSIENT_BEFORE_EXPAND));
    const rowCount = REPLAYED_ROW_COUNT + TRANSIENT_BEFORE_EXPAND;
    await expectLastRowFullyVisibleAtBottom(list, rowCount);
    const position = rowCount - 1;
    const offsetBefore = await headerOffsetInList(list, position);

    // A kattintás egy szkript futásban, az érkezés a következő ÜZENET
    // feladatban (`MessageChannel`): a kattintás renderje és annak effektjei
    // után, de a mérés (a következő képkocka `ResizeObserver` jelentése)
    // előtt. Nem időzítő: a feladat sorrend adja a helyét.
    await list.evaluate(
      (element, { rowPosition, data }) => {
        const header = element.querySelector(
          `[role="listitem"][aria-posinset="${CSS.escape(String(rowPosition))}"] [aria-expanded]`,
        );
        if (!(header instanceof HTMLElement)) {
          throw new TypeError('a fejléc nem található');
        }
        header.click();
        const channel = new MessageChannel();
        let hops = 0;
        channel.port1.addEventListener('message', () => {
          hops += 1;
          if (hops < 8) {
            channel.port2.postMessage(undefined);
            return;
          }
          globalThis.e2eDeliverFrameWithNextClick?.('run_event_transient', data);
          globalThis.document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
        channel.port1.start();
        channel.port2.postMessage(undefined);
      },
      { rowPosition: position, data: JSON.stringify(textDeltaTransientFrame('A mérés előtt')) },
    );
    await expect(page.getByRole('button', { name: 'Ugrás az aljára (1 új esemény)' })).toBeVisible();
    await waitForRowMeasured(list, position);
    streamServer.push(textDeltaTransientFrame('A mérés után'));
    await expect(page.getByRole('button', { name: 'Ugrás az aljára (2 új esemény)' })).toBeVisible();
    expect(await headerOffsetInList(list, position)).toBe(offsetBefore);
  });
}

// ============================================================
// AZ UTOLSÓ SOR KINYITÁSA IS MEGÁLLÍTJA A KÖVETÉST (user döntés 2026-09-25).
//
// Egy sor kinyitása a követést addig szünetelteti, amíg a felhasználó vissza
// nem ér az aljára vagy meg nem nyomja az "ugrás az aljára" gombot. A kinyitott
// UTOLSÓ sor a kinyitás után is látszik, tehát a mérés utáni jelentés szerint
// a lista "az alján áll": a mérés ezért nem kapcsolja vissza a követést, és a
// következő sor nem viszi el a kinyitott sort (a `bffd75d`-től a `da9fa70`-ig
// a törzs plusz az új sor magasságával vitte feljebb, research 17. és 18.
// szekció). Mind a négy kinyitási úton, két időzítésben: az új sor a mérés
// UTÁN, a lezárását is megvárva érkezik, illetve PONTOSAN a mérés commitjában,
// a passzív effektjei előtt (a React DevTools csatlakozási pontján,
// `installMeasuredCommitDelivery`; időzítő nincs, a commit sorrend adja a
// helyét).
// ============================================================

type ExpandPath = 'mouse' | 'space' | 'enter' | 'click';

const EXPAND_PATHS: readonly { readonly path: ExpandPath; readonly label: string }[] = [
  { path: 'mouse', label: 'egérrel' },
  { path: 'space', label: 'Space-szel' },
  { path: 'enter', label: 'Enterrel' },
  { path: 'click', label: 'csak click eseménnyel' },
];

async function expandWith(page: Page, header: Locator, path: ExpandPath): Promise<void> {
  switch (path) {
    case 'mouse': {
      const center = await header.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      });
      await page.mouse.click(center.x, center.y);
      return;
    }
    case 'space': {
      await header.focus();
      await page.keyboard.press('Space');
      return;
    }
    case 'enter': {
      await header.focus();
      await page.keyboard.press('Enter');
      return;
    }
    case 'click': {
      // A Playwright doksi szerint ez az `element.click()` megfelelője.
      await header.dispatchEvent('click');
      return;
    }
  }
}

/**
 * A lista az alján áll, és az utolsó sor a kinyitás célja.
 */
async function openLastRowTarget(
  page: Page,
  theme: 'light' | 'dark',
): Promise<{
  readonly streamServer: OpenStreamServer;
  readonly list: Locator;
  readonly rowCount: number;
  readonly header: Locator;
}> {
  const streamServer = await openFollowingTranscript(page, theme, serverHolder);
  const list = transcriptList(page);
  streamServer.pushBatch(transientFrames(TRANSIENT_BEFORE_EXPAND));
  const rowCount = REPLAYED_ROW_COUNT + TRANSIENT_BEFORE_EXPAND;
  await expectLastRowFullyVisibleAtBottom(list, rowCount);
  const header = list.locator(`[role="listitem"][aria-posinset="${String(rowCount)}"]`).getByRole('button');
  return { streamServer, list, rowCount, header };
}

for (const theme of ['light', 'dark'] as const) {
  for (const { path, label } of EXPAND_PATHS) {
    test(`követés közben ${label} kinyitott UTOLSÓ sor a mérése után érkező sorra is a helyén marad, és megjelenik az ugrás gomb (${theme} téma)`, async ({
      page,
    }) => {
      const { streamServer, list, rowCount, header } = await openLastRowTarget(page, theme);
      const offsetBefore = await headerOffsetInList(list, rowCount);

      await expandWith(page, header, path);
      await expect(header).toHaveAttribute('aria-expanded', 'true');
      await waitForRowMeasured(list, rowCount);
      streamServer.push(textDeltaTransientFrame('A mérés után'));
      await expect(page.getByRole('button', { name: 'Ugrás az aljára (1 új esemény)' })).toBeVisible();
      expect(offsetBefore).toStrictEqual(expect.any(Number));
      expect(await headerOffsetInList(list, rowCount)).toBe(offsetBefore);
    });

    test(`követés közben ${label} kinyitott UTOLSÓ sor törzsének végiggörgetése nem visszatérés az aljára: a következő sor nem viszi el (${theme} téma)`, async ({
      page,
    }) => {
      const { streamServer, list, rowCount, header } = await openLastRowTarget(page, theme);
      await expandWith(page, header, path);
      await expect(header).toHaveAttribute('aria-expanded', 'true');
      await waitForRowMeasured(list, rowCount);

      // A felhasználó a kinyitott törzset olvassa: a lista aljáig görget, a
      // látható tartomány eleje elmozdul, és az utolsó sor végig látszik.
      await wheelToBottom(page, list);
      await expectLastRowFullyVisibleAtBottom(list, rowCount);
      const offsetBefore = await headerOffsetInList(list, rowCount);
      streamServer.push(textDeltaTransientFrame('A törzs végiggörgetése után'));
      await expect(page.getByRole('button', { name: 'Ugrás az aljára (1 új esemény)' })).toBeVisible();
      expect(offsetBefore).toStrictEqual(expect.any(Number));
      expect(await headerOffsetInList(list, rowCount)).toBe(offsetBefore);
    });

    test(`követés közben ${label} kinyitott UTOLSÓ sor a mérés commitjában érkező sorra is a helyén marad, és megjelenik az ugrás gomb (${theme} téma)`, async ({
      page,
    }) => {
      await captureEventSources(page);
      await installMeasuredCommitDelivery(page);
      const { streamServer, list, rowCount, header } = await openLastRowTarget(page, theme);
      const offsetBefore = await headerOffsetInList(list, rowCount);

      await deliverFrameOnMeasuredCommit(page, rowCount, textDeltaTransientFrame('A mérés commitjában'));
      await expandWith(page, header, path);
      await expect(page.getByRole('button', { name: 'Ugrás az aljára (1 új esemény)' })).toBeVisible();
      expect(offsetBefore).toStrictEqual(expect.any(Number));
      expect(await headerOffsetInList(list, rowCount)).toBe(offsetBefore);
      streamServer.push(textDeltaTransientFrame('A mérés commitja után'));
      await expect(page.getByRole('button', { name: 'Ugrás az aljára (2 új esemény)' })).toBeVisible();
      expect(await headerOffsetInList(list, rowCount)).toBe(offsetBefore);
    });
  }
}

// A BECSUKÁS változatlan: a szünete a mérésig tart, utána a predikátum dönt.
// A hook a kattintás előtti `aria-expanded` értékből tudja, kinyitás vagy
// becsukás történik; a lista figyelője a React saját kezelője előtt fut.
for (const theme of ['light', 'dark'] as const) {
  test(`követés közben az alján becsukott sor után a követés folytatódik (${theme} téma)`, async ({ page }) => {
    const { streamServer, list, rowCount, header } = await openLastRowTarget(page, theme);
    await header.dispatchEvent('click');
    await waitForRowMeasured(list, rowCount);
    streamServer.push(textDeltaTransientFrame('A kinyitás után'));
    await page.getByRole('button', { name: 'Ugrás az aljára (1 új esemény)' }).click();
    await expectLastRowFullyVisibleAtBottom(list, rowCount + 1);

    await header.dispatchEvent('click');
    await expect(header).toHaveAttribute('aria-expanded', 'false');
    await waitForRowMeasured(list, rowCount);
    await expectFollowingAfterArrivals(page, streamServer, list, rowCount + 1);
  });

  test(`felgörgetve a kinyitott sor becsukása után a követés kikapcsolva marad (${theme} téma)`, async ({ page }) => {
    const streamServer = await openFollowingTranscript(page, theme, serverHolder);
    const list = transcriptList(page);
    await wheelToTop(page, list);
    const firstRow = list.locator('[role="listitem"][aria-posinset="1"]');
    await expect(firstRow).toBeInViewport({ ratio: 1 });
    streamServer.push(textDeltaTransientFrame('Felgörgetve'));
    await expect(page.getByRole('button', { name: 'Ugrás az aljára (1 új esemény)' })).toBeVisible();

    // A becsukás a kinyitás párja: a szünet a predikátum szerint zárul, és
    // az utolsó sor nem látszik.
    const header = list.locator('[role="listitem"][aria-posinset="2"]').getByRole('button');
    await header.dispatchEvent('click');
    await waitForRowMeasured(list, 2);
    await header.dispatchEvent('click');
    await expect(header).toHaveAttribute('aria-expanded', 'false');
    await waitForRowMeasured(list, 2);
    streamServer.push(textDeltaTransientFrame('A becsukás után'));
    await expect(page.getByRole('button', { name: 'Ugrás az aljára (2 új esemény)' })).toBeVisible();
    await expect(firstRow).toBeInViewport({ ratio: 1 });
  });
}

const TRANSCRIPT_LAYOUTS: readonly { readonly name: string; readonly layout: TranscriptLayout }[] = [
  { name: '1440x900', layout: WIDE_LAYOUT },
  { name: '375x812', layout: TABBED_LAYOUT },
];

// ============================================================
// AZ UGRÁS GOMB MEGJELENÉSE NEM MOZDÍTJA A LISTÁT (user döntés 2026-09-25).
//
// A gomb sávja előre fenntartott hely a lista fölött: új esemény nélkül a
// gomb láthatatlan, de a dobozát megtartja (`transcript-panel.css`,
// `transcript-panel__jump--idle`). Korábban a sáv a gombbal együtt jelent
// meg, és a listát 36 pixellel lejjebb tolta: a lista alján kinyitott utolsó
// sor 53 pixeles fejlécéből 1440 és 375 pixelen is 17 pixel maradt a lista
// látható területén, a szövege nélkül (research 19. szekció). A fejléc helye itt
// az ABLAKBAN mért, nem a listához képest, és a gomb nem takarhat sort: a
// lista fölött, teljes egészében az ablakban áll.
// ============================================================

for (const { name, layout } of TRANSCRIPT_LAYOUTS) {
  for (const theme of ['light', 'dark'] as const) {
    test(`az ugrás gomb megjelenése a lista tartalmát nem mozdítja: a kinyitott utolsó sor fejléce az ablakban a helyén marad, és a gomb elérhető (${name}, ${theme} téma)`, async ({
      page,
    }) => {
      const streamServer = await openFollowingTranscript(page, theme, serverHolder, layout);
      const list = transcriptList(page);
      streamServer.pushBatch(transientFrames(TRANSIENT_BEFORE_EXPAND));
      const rowCount = REPLAYED_ROW_COUNT + TRANSIENT_BEFORE_EXPAND;
      await expectLastRowFullyVisibleAtBottom(list, rowCount);
      const header = list.locator(`[role="listitem"][aria-posinset="${String(rowCount)}"]`).getByRole('button');
      await header.dispatchEvent('click');
      await expect(header).toHaveAttribute('aria-expanded', 'true');
      await waitForRowMeasured(list, rowCount);
      await expect(header).toBeInViewport({ ratio: 1 });
      const listTopBefore = await list.evaluate((element) => element.getBoundingClientRect().top);
      const headerTopBefore = await headerTopInViewport(list, rowCount);
      expect(headerTopBefore).toStrictEqual(expect.any(Number));

      streamServer.push(textDeltaTransientFrame('A gomb megjelenése'));
      const jump = page.getByRole('button', { name: 'Ugrás az aljára (1 új esemény)' });
      await expect(jump).toBeVisible();
      expect(await list.evaluate((element) => element.getBoundingClientRect().top)).toBe(listTopBefore);
      expect(await headerTopInViewport(list, rowCount)).toBe(headerTopBefore);
      await expect(header).toBeInViewport({ ratio: 1 });
      await expect(jump).toBeInViewport({ ratio: 1 });
      expect(await jump.evaluate((element) => element.getBoundingClientRect().bottom)).toBeLessThanOrEqual(
        listTopBefore,
      );

      await jump.click();
      await expectLastRowFullyVisibleAtBottom(list, rowCount + 1);
      await expect(jumpButton(page)).toHaveCount(0);
    });
  }
}

// ============================================================
// NEM TELI LISTÁN IS ÁLL A KINYITÁS SZÜNETE (független ellenőrzés
// 2026-09-25).
//
// Nem teli listán egy új sor után a `react-window` előbb még a régi látható
// tartományt jelenti (a régi utolsó sorra vágva), majd az újat, amiben az új
// sor már látszik. A hook a kettőt korábban "az alj elhagyása, majd visszatérés"
// párnak vette, és a szünetet lezárta: gomb nem jelent meg, és amikor a lista
// megtelt, minden új sor a kinyitott sort 53 pixellel feljebb vitte
// (`is-pre-arrival-range-report.ts`, research 19. szekció). Az utolsó és egy
// korábbi sor kinyitása után is minden új sorral nő a gomb száma, és a
// kinyitott fejléc az ablakban a helyén marad, a lista megtelése után is.
// ============================================================

const SHORT_REPLAYED_ROW_COUNT = 3;

/**
 * Az egyenként érkező új sorok száma: mindkét elrendezésben elég ahhoz, hogy
 * a kinyitott törzzsel együtt a lista megteljen (a független ellenőrzés
 * szerint 1440 pixelen a 8., 375 pixelen a 4. új sornál).
 */
const SHORT_LIST_ARRIVALS = 12;

for (const { name, layout } of TRANSCRIPT_LAYOUTS) {
  for (const theme of ['light', 'dark'] as const) {
    for (const target of [
      { label: 'az utolsó', position: SHORT_REPLAYED_ROW_COUNT },
      { label: 'egy korábbi', position: 1 },
    ] as const) {
      test(`nem teli listán ${target.label} sor kinyitása után minden új sorral nő az ugrás gomb száma, és a lista megtelése után sem viszi el a sort (${name}, ${theme} téma)`, async ({
        page,
      }) => {
        const streamServer = await openFollowingTranscript(page, theme, serverHolder, layout, SHORT_REPLAYED_ROW_COUNT);
        const list = transcriptList(page);
        const header = list
          .locator(`[role="listitem"][aria-posinset="${String(target.position)}"]`)
          .getByRole('button');
        await header.dispatchEvent('click');
        await expect(header).toHaveAttribute('aria-expanded', 'true');
        await waitForRowMeasured(list, target.position);
        const headerTopBefore = await headerTopInViewport(list, target.position);
        expect(headerTopBefore).toStrictEqual(expect.any(Number));

        let rowCount = SHORT_REPLAYED_ROW_COUNT;
        for (let arrived = 1; arrived <= SHORT_LIST_ARRIVALS; arrived += 1) {
          streamServer.push(textDeltaTransientFrame(`Rövid lista ${String(arrived)}`));
          rowCount += 1;
          await expect(
            page.getByRole('button', { name: `Ugrás az aljára (${String(arrived)} új esemény)` }),
          ).toBeVisible();
          expect(await headerTopInViewport(list, target.position)).toBe(headerTopBefore);
        }
        // A lista közben megtelt: az utolsó sor a lista látható alja alatt áll
        // (vagy ki sem rajzolt, mert a túlrajzolási sávon is túl van).
        expect((await lastRowBottomOverflow(list, rowCount)) ?? Infinity).toBeGreaterThan(0);
      });
    }
  }
}

// ============================================================
// NINCS BÖNGÉSZŐ GÖRGETÉS RÖGZÍTÉS A LISTÁN (user döntés 2026-09-24).
//
// Bekapcsolt scroll anchoring mellett, a gomb helyének fenntartása előtt,
// folyamatos streamnél a véletlen fázisú kinyitások egy részében a lista a
// hook nélkül, a böngésző saját igazításával elmozdult (saját mérésekben
// mind -36 pixel, egy független ellenőrzésben egy -574 pixeles teljes
// elrántás is; research 17-19. szekció). A teszt KIZÁRÓLAG A KONFIGURÁCIÓT
// őrzi: a lista kiszámított `overflow-anchor`
// értéke `none` (a CSS Scroll Anchoring spec szerint ekkor a görgető dobozban
// nincs horgony, tehát nincs igazítás). A jelenség maga determinisztikusan
// nem állítható elő: hat, időzítő nélküli érkezési móddal (a kattintás
// feladatában, a mérés commitjában, a mérés után, érkezés nélkül, és a
// kinyitás előtt követett sorral két fázisban) bekapcsolt rögzítéssel sem
// mozdult a lista (mérő eszköz, `anchoring` jelenet). A korábbi, képkockánként
// mérő rész ezért vak volt (a CSS nélkül is zöld), és kikerült.
// ============================================================

test('a listán nincs böngésző görgetés rögzítés: a kiszámított overflow-anchor értéke none', async ({ page }) => {
  await openFollowingTranscript(page, 'light', serverHolder);
  expect(await transcriptList(page).evaluate((element) => getComputedStyle(element).overflowAnchor)).toBe('none');
});
