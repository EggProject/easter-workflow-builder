/* eslint-disable unicorn/no-null -- a wire-szintű rekordok nullable mezői a
   protokoll szerint ténylegesen `null` értéket hordoznak
   (packages/protocol/src/run/run-record.ts,
   .../transcript/run-event-record.ts, .../workflow/workflow-record.ts,
   .../event-stream/stream-frame.ts). */
// SSE `page.route()` alapeset (T-008-28): kapcsolat megnyílása, több
// `data:` keret sorrendben, mind az öt nevesített `event:` keret, a
// `Content-Type` fejléc, és az `id:` mező hatása egy kapcsolaton belül
// (docs/research/2026-08-30-sse-mockolas-meres.md 2.1-2.5, 2.8 mérése).
import {
  encodeStreamFrame,
  type RunEventRecord,
  type RunSummary,
  type StreamFrame,
  type WorkflowSummary,
} from '@easter-workflow-builder/protocol';
import { expect, test } from './coverage-fixture.ts';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';
import { STREAM_ORIGIN } from './api-origin.ts';

const WORKFLOW: WorkflowSummary = {
  id: 'w-alfa',
  name: 'Alfa workflow',
  description: null,
  providerId: null,
  createdAtMs: 1,
  updatedAtMs: 1,
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

const RUN_SUCCEEDED: RunSummary = { ...RUN_PENDING, status: 'succeeded', startedAtMs: 2, finishedAtMs: 3 };

const RUN_EVENT_RECORD: RunEventRecord = {
  id: 1,
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

async function setup(
  page: Parameters<typeof installApiMocks>[0],
  listRunsResponses: readonly (readonly RunSummary[])[],
): Promise<void> {
  let callIndex = 0;
  await installApiMocks(page, [
    mockRoute('listRuns', async (route) => {
      const response = listRunsResponses[Math.min(callIndex, listRunsResponses.length - 1)];
      callIndex += 1;
      await route.fulfill(jsonBody(response));
    }),
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([WORKFLOW]))),
    mockRoute('replaceStreamSubscriptions', async (route) =>
      route.fulfill(jsonBody({ streamId: 'e2e-stream', subscriptions: [] })),
    ),
  ]);
}

test('a kapcsolat sikeres megnyitása után a "kapcsolódás" felirat nem látható', async ({ page }) => {
  // A `connecting` fázis a mountoláskor szinkron, kezdeti render állapot
  // (use-stream-connection.ts: `useState<number>(0)`), a mockolt válasz
  // viszont a valódi hálózati kör nélkül, gyakorlatilag azonnal megnyílik -
  // a `page.goto()` maga is a `load` eseményig vár, ami már a kapcsolat
  // megnyitása UTÁN következhet be, tehát az átmeneti feliratot a teszt
  // indulása előtt eltűnhet: nincs garantált megfigyelhető ablak. Az átmeneti
  // állapotot a `use-stream-connection.spec.tsx` (kontrollálható
  // FakeEventSource-szal) determinisztikusan fedi; ez az e2e teszt a
  // megbízhatóan ellenőrizhető VÉGÁLLAPOTOT igazolja: a valódi böngésző +
  // mockolt SSE válasz párosa ténylegesen `open`-ig jut.
  await setup(page, [[RUN_PENDING]]);
  await page.route(`${STREAM_ORIGIN}/events**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: encodeStreamFrame({
        event: 'stream_ready',
        streamId: 'e2e-stream',
        serverInstanceId: 's-1',
        subscriptions: [],
      }),
    });
  });

  await page.goto('/runs');

  await expect(page.getByRole('table', { name: 'Futások' })).toBeVisible();
  await expect(page.getByText('kapcsolódás')).toBeHidden();
});

test('a Content-Type fejléc pontosan text/event-stream', async ({ page }) => {
  await setup(page, [[RUN_PENDING]]);
  await page.route(`${STREAM_ORIGIN}/events**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: encodeStreamFrame({
        event: 'stream_ready',
        streamId: 'e2e-stream',
        serverInstanceId: 's-1',
        subscriptions: [],
      }),
    });
  });

  const responsePromise = page.waitForResponse((response) => response.url().includes('/events'));
  await page.goto('/runs');
  const response = await responsePromise;

  expect(response.headers()['content-type']).toBe('text/event-stream');
});

test('több data: keret sorrendben dolgozódik fel: run_event, run_event_transient és replay_complete mind újratölti a listát', async ({
  page,
}) => {
  // A pontos hívásszámra (mountkori + 3 keret általi újratöltés) NEM
  // támaszkodik az igazolás: a három keret a HTML SSE feldolgozási modell
  // szerint külön, egymást követő taskként érkezik (nem egyetlen szinkron
  // dispatch-körben), tehát mindegyik saját `loadRuns()` hívást indíthat, de
  // ezek tényleges befejezési SORRENDJE a mockolt hálózati rétegen nem
  // garantált. A `setup` a `Math.min(callIndex, hossz - 1)` kapcsolással az
  // ELSŐ hívásra `RUN_PENDING`-et, MINDEN további hívásra `RUN_SUCCEEDED`-et
  // ad: az igazolás így attól függetlenül determinisztikus, hogy pontosan
  // hány újratöltés fut le a keret-burst hatására.
  await setup(page, [[RUN_PENDING], [RUN_SUCCEEDED]]);
  const frames: readonly StreamFrame[] = [
    { event: 'stream_ready', streamId: 'e2e-stream', serverInstanceId: 's-1', subscriptions: [] },
    { event: 'run_event', delivery: 'live', runEvent: RUN_EVENT_RECORD },
    {
      event: 'run_event_transient',
      runId: 'r-1',
      stepRunId: null,
      kind: 'sdk_stream_event',
      occurredAtMs: 4,
      payload: {},
    },
    { event: 'replay_complete', runId: 'r-1', throughEventId: 1 },
  ];
  await page.route(`${STREAM_ORIGIN}/events**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: frames.map((frame) => encodeStreamFrame(frame)).join(''),
    });
  });

  await page.goto('/runs');

  const table = page.getByRole('table', { name: 'Futások' });
  await expect(table.getByRole('row', { name: /r-1/ })).toContainText('sikeres');
});

test('a stream_ready keret NEM váltja ki a lista újratöltését', async ({ page }) => {
  let listRunsCallCount = 0;
  await installApiMocks(page, [
    mockRoute('listRuns', async (route) => {
      listRunsCallCount += 1;
      await route.fulfill(jsonBody([RUN_PENDING]));
    }),
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([WORKFLOW]))),
    mockRoute('replaceStreamSubscriptions', async (route) =>
      route.fulfill(jsonBody({ streamId: 'e2e-stream', subscriptions: [] })),
    ),
  ]);
  await page.route(`${STREAM_ORIGIN}/events**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: encodeStreamFrame({
        event: 'stream_ready',
        streamId: 'e2e-stream',
        serverInstanceId: 's-1',
        subscriptions: [],
      }),
    });
  });

  await page.goto('/runs');
  await expect(page.getByRole('table', { name: 'Futások' }).getByRole('row', { name: /r-1/ })).toBeVisible();

  // Egyetlen betöltés a csatolt-kori automatikus hívásból; a stream_ready
  // a RELOAD_TRIGGERING_FRAME_EVENTS halmaznak nem tagja.
  expect(listRunsCallCount).toBe(1);
});

/**
 * Egy `stream_ready` keret a megadott szerver példány azonosítóval és
 * feliratkozás listával. A `subscriptions` alakja azonos a `PUT` válaszával
 * (`stream-subscription.ts`).
 */
function streamReadyFrame(serverInstanceId: string, replayingRunIds: readonly string[]): StreamFrame {
  return {
    event: 'stream_ready',
    streamId: 'e2e-stream',
    serverInstanceId,
    subscriptions: replayingRunIds.map((runId) => ({ runId, fromEventId: 0, replayLimit: 100 })),
  };
}

test('érvénytelen JSON törzsű keret figyelmen kívül marad, a kapcsolat tovább él', async ({ page }) => {
  // A `handleFrame` a `JSON.parse` köré tett try/catch-csel némán eldobja a
  // sérült keretet. A rá következő, ép `stream_ready` viszont feldolgozódik,
  // tehát a hibás keret nem rontja el a kapcsolatot.
  let listRunsCallCount = 0;
  await installApiMocks(page, [
    mockRoute('listRuns', async (route) => {
      listRunsCallCount += 1;
      await route.fulfill(jsonBody([RUN_PENDING]));
    }),
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([WORKFLOW]))),
    mockRoute('replaceStreamSubscriptions', async (route) =>
      route.fulfill(jsonBody({ streamId: 'e2e-stream', subscriptions: [] })),
    ),
  ]);
  await page.route(`${STREAM_ORIGIN}/events**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: `event: run_event\ndata: ez nem json\n\n${encodeStreamFrame(streamReadyFrame('s-1', []))}`,
    });
  });

  await page.goto('/runs');

  await expect(page.getByRole('table', { name: 'Futások' }).getByRole('row', { name: /r-1/ })).toBeVisible();
  // A sérült `run_event` keret NEM váltott ki újratöltést: egyetlen hívás
  // volt, a csatoláskori.
  expect(listRunsCallCount).toBe(1);
});

test('ismeretlen alakú keret figyelmen kívül marad, a kapcsolat tovább él', async ({ page }) => {
  // A törzs érvényes JSON, de a `StreamFrameSchema` diszkriminált uniója
  // egyetlen ágra sem illeszkedik: a `decodeStreamFrame` hibaágat ad, és a
  // `handleFrame` visszatér.
  let listRunsCallCount = 0;
  await installApiMocks(page, [
    mockRoute('listRuns', async (route) => {
      listRunsCallCount += 1;
      await route.fulfill(jsonBody([RUN_PENDING]));
    }),
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([WORKFLOW]))),
    mockRoute('replaceStreamSubscriptions', async (route) =>
      route.fulfill(jsonBody({ streamId: 'e2e-stream', subscriptions: [] })),
    ),
  ]);
  await page.route(`${STREAM_ORIGIN}/events**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: `event: run_event\ndata: {"event":"nincs_ilyen_keret"}\n\n${encodeStreamFrame(streamReadyFrame('s-1', []))}`,
    });
  });

  await page.goto('/runs');

  await expect(page.getByRole('table', { name: 'Futások' }).getByRole('row', { name: /r-1/ })).toBeVisible();
  expect(listRunsCallCount).toBe(1);
});

test('ugyanaz a serverInstanceId kétszer NEM számít szerver újraindulásnak', async ({ page }) => {
  // A `setServerInstance` frissítője azonos azonosítóra változatlanul adja
  // vissza az előző állapotot, tehát a `serverRestartCount` nem nő, és a
  // képernyő nem tölt újra (SPEC-007 16. szekció 44. kritérium ellenpárja).
  let listRunsCallCount = 0;
  await installApiMocks(page, [
    mockRoute('listRuns', async (route) => {
      listRunsCallCount += 1;
      await route.fulfill(jsonBody([RUN_PENDING]));
    }),
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([WORKFLOW]))),
    mockRoute('replaceStreamSubscriptions', async (route) =>
      route.fulfill(jsonBody({ streamId: 'e2e-stream', subscriptions: [] })),
    ),
  ]);
  await page.route(`${STREAM_ORIGIN}/events**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: [streamReadyFrame('s-1', []), streamReadyFrame('s-1', [])]
        .map((frame) => encodeStreamFrame(frame))
        .join(''),
    });
  });

  await page.goto('/runs');

  await expect(page.getByRole('table', { name: 'Futások' }).getByRole('row', { name: /r-1/ })).toBeVisible();
  expect(listRunsCallCount).toBe(1);
});

// A `replaying` fázis (feliratkozásos `stream_ready` plusz `replay_complete`)
// MÉRTEN nem figyelhető meg `page.route()` mockon: a `route.fulfill()` lezárt
// válasz, tehát az `EventSource` a keretek után azonnal `error`-t kap, kiesik
// `OPEN`-ből, és a `computePhase` a `reconnecting` ágra fut. Ezek a tesztek
// ezért a valódi teszt szerveren futnak, lásd `sse-real-server.spec.ts`.

test('protocol_error keret nem szakítja meg a kapcsolatot, a lista tovább használható marad', async ({ page }) => {
  await setup(page, [[RUN_PENDING]]);
  const frames: readonly StreamFrame[] = [
    { event: 'stream_ready', streamId: 'e2e-stream', serverInstanceId: 's-1', subscriptions: [] },
    { event: 'protocol_error', code: 'invalid_request', message: 'teszt hiba', runId: null },
  ];
  await page.route(`${STREAM_ORIGIN}/events**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: frames.map((frame) => encodeStreamFrame(frame)).join(''),
    });
  });

  await page.goto('/runs');

  await expect(page.getByRole('table', { name: 'Futások' }).getByRole('row', { name: /r-1/ })).toBeVisible();
});
