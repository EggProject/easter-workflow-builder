// A futás nézet valódi `node:http` SSE teszt szerverrel (2026-09-25). A
// `sse-real-server.spec.ts` és a transcript görgetés mérő eszköze
// (`apps/web/measurement/transcript-scroll.ts`) közös fixtúrája: a szerver,
// a keretek, a REST mockok és a transcript lista mérései EGYETLEN forrásból
// jönnek, hogy a mérés és a regressziós teszt ugyanazon a felálláson fusson
// (`.claude/CLAUDE.md` 12. szekció: minden bizonyíték előállító eszköz a
// repóba tartozik).
//
// Minden teszt szervere az operációs rendszer által kiosztott szabad porton
// figyel (`listenOnLoopback`), és a lap a build időben rögzített
// `STREAM_ORIGIN` felé induló `GET /events` kérését erre a portra irányítja
// (`routeStreamToPort`). Így a párhuzamos workerek szerverei nem ütköznek
// (korábban mind a `STREAM_ORIGIN` 4174-es portjára kötődött, és
// `--repeat-each 3` mellett három workerrel `EADDRINUSE` jött).
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { Server as NetServer } from 'node:net';
import type {
  RunDetail,
  RunEventKind,
  RunSnapshotResponse,
  StepRunRecord,
  StreamFrame,
} from '@easter-workflow-builder/protocol';
import { encodeStreamFrame } from '@easter-workflow-builder/protocol';
import { expect, type Locator, type Page } from '@playwright/test';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';
import { PREVIEW_ORIGIN, STREAM_ORIGIN } from './api-origin.ts';
import { makeRunEventRecord } from './transcript-fixture.ts';

declare global {
  // Ambiens globális változó deklaráció, a `coverage-fixture.ts` mintájára: a
  // TypeScript a `globalThis` kiegészítését csak `var` alakban engedi.
  /**
   * A következő `click` esemény capture fázisában a keretet a lap nyitott
   * `EventSource` példányain kézbesíti (`captureEventSources`).
   */
  var e2eDeliverFrameWithNextClick: ((type: string, data: string) => void) | undefined;
  /**
   * A keret azonnali kézbesítése a lap nyitott `EventSource` példányain
   * (`captureEventSources`).
   */
  var e2eDeliverFrame: ((type: string, data: string) => void) | undefined;
  /**
   * A keret kézbesítése abban a React commitban, amelyikben a lista a
   * kinyitott sor MÉRT magasságával számol (`installMeasuredCommitDelivery`).
   */
  var e2eDeliverFrameOnMeasuredCommit: ((position: number, type: string, data: string) => void) | undefined;
}

/**
 * A teszt szerverek címe. Kifejezetten a loopback IPv4 cím, nem a `localhost`
 * név: a szabad portot az operációs rendszer erre a címre osztja ki, és a lap
 * kérése is pontosan ide megy, tehát egy másik címre kötött folyamat nem
 * kaphatja meg.
 */
const LOOPBACK_HOST = '127.0.0.1';

/**
 * A szerver indítása a loopback címen. A `port` alapértéke `0`: a Node doksi
 * szerint ekkor az operációs rendszer egy tetszőleges, szabad portot oszt ki,
 * ami a `listening` esemény után a `server.address().port` mezőből olvasható
 * (<https://nodejs.org/api/net.html#serverlistenport-host-backlog-callback>).
 * Konkrét port csak egy ugyanabban a tesztben korábban kiosztott port újra
 * kötésére jár (a szerver leállás és újraindulás tesztjei). Visszatér a
 * porttal, amikor a szerver már fogad kapcsolatot.
 */
export async function listenOnLoopback(server: NetServer, port = 0): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, LOOPBACK_HOST, () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  // TCP porton figyelő szervernél az érték a Node doksi szerint mindig
  // `AddressInfo`; a szöveges alak a pipe és a Unix socket esete.
  if (address === null || typeof address === 'string') {
    throw new TypeError('a teszt szerver nem TCP porton figyel');
  }
  return address.port;
}

/**
 * A lap `STREAM_ORIGIN` felé induló `GET /events` kéréseinek átirányítása a
 * teszt szerver portjára. A `route.continue({ url })` a Playwright doksi
 * szerint a kérés URL-jét cseréli
 * (<https://playwright.dev/docs/api/class-route#route-continue>), Chromiumban
 * a lap számára nem megfigyelhető módon (CDP `Fetch.continueRequest` `url`,
 * <https://chromedevtools.github.io/devtools-protocol/tot/Fetch/#method-continueRequest>):
 * a kérés a valódi hálózaton megy, a válasz streamelve érkezik, tehát ez nem
 * mock, csak a cél port cseréje. Az `EventSource` újracsatlakozása is új
 * kérés, és ugyanezen a routeon megy át.
 */
export async function routeStreamToPort(page: Page, port: number): Promise<void> {
  await page.route(`${STREAM_ORIGIN}/events**`, async (route) => {
    const url = new URL(route.request().url());
    url.host = `${LOOPBACK_HOST}:${String(port)}`;
    await route.continue({ url: url.href });
  });
}

/**
 * A szerver indítása szabad porton, és a lap stream kéréseinek átirányítása
 * rá. Visszatér a porttal.
 */
export async function attachStreamServer(page: Page, server: NetServer): Promise<number> {
  const port = await listenOnLoopback(server);
  await routeStreamToPort(page, port);
  return port;
}

/**
 * A Vite preview szerver és a `STREAM_ORIGIN` más origin (4173 kontra 4174),
 * tehát az `EventSource` valódi, hitelesítő adatok nélküli CORS kérést indít
 * (a port csere ezen nem változtat, a lap originje ugyanaz):`Access-Control-Allow-Origin` fejléc nélkül a
 * böngésző a választ nem adja át a JS rétegnek (a `readyState` sosem ér
 * OPEN-ig, a `page.route()`-mockolt esetekkel ellentétben, ahol a CDP által
 * teljesített válasz nem megy át ezen az ellenőrzésen).
 */
export const SSE_RESPONSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Access-Control-Allow-Origin': PREVIEW_ORIGIN,
};

/**
 * Egy `stream_ready` keret a megadott szerver példány azonosítóval, és
 * annyi feliratkozással, ahány futás pótlás alatt áll. A `subscriptions`
 * alakja azonos a `PUT` válaszáéval (`stream-subscription.ts`).
 */
export function streamReadyFrame(serverInstanceId: string, replayingRunIds: readonly string[]): StreamFrame {
  return {
    event: 'stream_ready',
    streamId: 'e2e-stream',
    serverInstanceId,
    subscriptions: replayingRunIds.map((runId) => ({ runId, fromEventId: 0, replayLimit: 100 })),
  };
}

export interface OpenStreamServer {
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
 * `computePhase` `replaying`/`live` ága nem figyelhető meg. A szerver szabad
 * porton indul, és a lap stream kérései rá mennek (`attachStreamServer`).
 */
export async function startOpenStreamServer(
  page: Page,
  initialFrames: readonly StreamFrame[],
): Promise<OpenStreamServer> {
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
  await attachStreamServer(page, server);

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

/* eslint-disable unicorn/no-null -- a wire-szintű rekordok nullable mezői a protokoll szerint ténylegesen `null` értéket hordoznak */

export const RUN_SNAPSHOT: RunSnapshotResponse = {
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

export const NO_STEP_RUNS: readonly StepRunRecord[] = [];

export function runDetailWithStatus(status: RunDetail['status']): RunDetail {
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

export function stepRun(status: StepRunRecord['status']): StepRunRecord {
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
export function stepEventFrame(id: number, kind: RunEventKind, delivery: 'live' | 'replayed'): StreamFrame {
  return {
    event: 'run_event',
    delivery,
    runEvent: makeRunEventRecord(id, 'r-1', { stepRunId: 's-1', kind }),
  };
}

export interface RunViewMockState {
  runStatus: RunDetail['status'];
  stepRuns: readonly StepRunRecord[];
}

/**
 * A futás nézet REST mockjai: a futás rekordja és a lépés futások a teszt
 * által menet közben átírható `state` objektumból jönnek.
 */
export async function mockRunView(page: Page, state: RunViewMockState): Promise<void> {
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

/**
 * Egy élő szöveg delta átmeneti kerete, pontosan abban az alakban, ahogy a
 * szerver a kikapcsolt delta kapcsolójú futásnál kiküldi
 * (`apps/server/src/engine-assembly/classify-published-event.ts`).
 */
export function textDeltaTransientFrame(text: string): StreamFrame {
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
export function transcriptList(page: Page): Locator {
  return page.getByRole('list', { name: 'Futás eseményei' });
}

/**
 * A pótlás tárolt sorainak száma: elég ahhoz, hogy a lista görgethető legyen.
 */
export const REPLAYED_ROW_COUNT = 20;

/**
 * Az utolsó sor alsó éle mínusz a lista látható alsó éle, pixelben:
 * pozitív érték esetén ennyi lóg ki az utolsó sorból a lista alján.
 * `undefined`, amíg a sor nincs kirajzolva.
 */
export async function lastRowBottomOverflow(list: Locator, rowCount: number): Promise<number | undefined> {
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
export async function expectLastRowFullyVisibleAtBottom(list: Locator, rowCount: number): Promise<void> {
  const lastRow = list.locator(`[role="listitem"][aria-posinset="${String(rowCount)}"]`);
  await expect(lastRow).toBeInViewport({ ratio: 1 });
  await expect.poll(async () => Math.abs((await lastRowBottomOverflow(list, rowCount)) ?? Infinity)).toBeLessThan(0.5);
}

/**
 * Az ablakméret, amin a futás nézet megnyílik. A `--ep-screen-md` alatti fül
 * sávban a transcript a második fülön áll (`RunViewLayout`), tehát előbb azt
 * kell kiválasztani.
 */
export interface TranscriptLayout {
  readonly viewport: { readonly width: number; readonly height: number };
  readonly isTabbed: boolean;
}

/**
 * A két mért ablakméret (research 13. és 16. szekció): az osztott asztali
 * elrendezés és a 375 pixeles fül sáv.
 */
export const WIDE_LAYOUT: TranscriptLayout = { viewport: { width: 1440, height: 900 }, isTabbed: false };
export const TABBED_LAYOUT: TranscriptLayout = { viewport: { width: 375, height: 812 }, isTabbed: true };

/**
 * A futás nézet megnyitása a pótlással; visszatér, amikor az utolsó tárolt
 * sor kirajzolódott, és a lista az alján áll. A szerver a `goto` ELŐTT kerül
 * a hívó tartójába, hogy egy elbukó megnyitás után is a hívó zárja le, és a
 * szerver nyitva maradt kapcsolata ne tartsa életben a portot. Elrendezés
 * nélkül a Playwright alap ablakán nyílik meg. A pótolt sorok száma alapból
 * `REPLAYED_ROW_COUNT` (a lista görgethető); kevesebb sorral a lista nem telik
 * meg.
 */
export async function openFollowingTranscript(
  page: Page,
  theme: 'light' | 'dark',
  serverHolder: { current: Server | undefined },
  layout?: TranscriptLayout,
  replayedRowCount = REPLAYED_ROW_COUNT,
): Promise<OpenStreamServer> {
  const streamServer = await startOpenStreamServer(page, [streamReadyFrame('s-1', [])]);
  serverHolder.current = streamServer.server;
  await page.addInitScript((mode) => {
    globalThis.localStorage.setItem('eggTheme', mode);
  }, theme);
  await mockRunView(page, { runStatus: 'running', stepRuns: [stepRun('running')] });
  if (layout !== undefined) {
    await page.setViewportSize(layout.viewport);
  }
  await page.goto('/run?runId=r-1');
  if (layout?.isTabbed === true) {
    await page.getByRole('tab', { name: 'Transcript' }).click();
  }
  streamServer.pushBatch([
    ...Array.from({ length: replayedRowCount }, (_, index) => stepEventFrame(index + 1, 'step_started', 'replayed')),
    { event: 'replay_complete', runId: 'r-1', throughEventId: replayedRowCount },
  ]);
  const list = transcriptList(page);
  // A rövid, nem teli lista utolsó sora nem a lista alján áll: ott a
  // követés pontosan a sor teljes láthatóságát jelenti.
  await (replayedRowCount < REPLAYED_ROW_COUNT
    ? expect(list.locator(`[role="listitem"][aria-posinset="${String(replayedRowCount)}"]`)).toBeInViewport({
        ratio: 1,
      })
    : expectLastRowFullyVisibleAtBottom(list, replayedRowCount));
  return streamServer;
}

/**
 * A kinyitott sor fejlécének függőleges helye az ablakban, pixelben. A
 * `headerOffsetInList`-tel ellentétben a lista elmozdulását is tartalmazza:
 * ezen látszik, ha a lista fölött megjelenő elem a listát lejjebb tolja.
 * `undefined`, amíg a sor nincs kirajzolva.
 */
export async function headerTopInViewport(list: Locator, position: number): Promise<number | undefined> {
  return list.evaluate((element, rowPosition) => {
    const header = element.querySelector(
      `[role="listitem"][aria-posinset="${CSS.escape(String(rowPosition))}"] [aria-expanded]`,
    );
    return header?.getBoundingClientRect().top;
  }, position);
}

/**
 * Egy sor, amit a lista fölött lebegő "Ugrás az aljára" gomb (részben) takar.
 */
export interface RowUnderJumpButton {
  readonly position: number;
  /**
   * Ennyi pixellel kell a lista tartalmát feljebb görgetni, hogy a sor alsó
   * éle a gomb felső élére kerüljön (a sor a gomb fölé).
   */
  readonly shiftAbove: number;
  /**
   * Ugyanez a gomb alá: negatív érték lefelé görgetést jelent.
   */
  readonly shiftBelow: number;
  /**
   * A két eltolás közül legalább egy a lista görgetési tartományán belül
   * van, és utána a sor teljes egészében a lista látható területén, a gomb
   * nélkül áll: a sor görgetéssel elérhető.
   */
  readonly isReachableByScrolling: boolean;
}

/**
 * A lista kirajzolt sorai közül azok, amiket a gomb doboza a lista látható
 * területén belül takar, és hogy görgetéssel kiszabadíthatók-e. A gomb doboza
 * az ablakban mért (`boundingBox`), ugyanabban a koordináta rendszerben, mint
 * a sorok `getBoundingClientRect` értéke. A 0,5 pixeles tűrés ugyanaz, mint az
 * `expectLastRowFullyVisibleAtBottom` állításáé.
 */
export async function rowsUnderJumpButton(list: Locator, jump: Locator): Promise<readonly RowUnderJumpButton[]> {
  const box = await jump.boundingBox();
  if (box === null) {
    return [];
  }
  return list.evaluate((element, button) => {
    const tolerance = 0.5;
    const buttonBottom = button.y + button.height;
    const buttonRight = button.x + button.width;
    const visibleTop = element.getBoundingClientRect().top + element.clientTop;
    const visibleBottom = visibleTop + element.clientHeight;
    const minShift = -element.scrollTop;
    const maxShift = element.scrollHeight - element.clientHeight - element.scrollTop;
    return [...element.querySelectorAll('[role="listitem"]')].flatMap((item) => {
      const row = item.getBoundingClientRect();
      const top = Math.max(row.top, visibleTop);
      const bottom = Math.min(row.bottom, visibleBottom);
      const isOverlapping =
        Math.min(row.right, buttonRight) > Math.max(row.left, button.x) &&
        Math.min(bottom, buttonBottom) > Math.max(top, button.y);
      if (!isOverlapping) {
        return [];
      }
      const shiftAbove = row.bottom - button.y;
      const shiftBelow = row.top - buttonBottom;
      const isFreeAfter = (shift: number): boolean =>
        shift >= minShift - tolerance &&
        shift <= maxShift + tolerance &&
        row.top - shift >= visibleTop - tolerance &&
        row.bottom - shift <= visibleBottom + tolerance;
      return [
        {
          position: Number(item.getAttribute('aria-posinset')),
          shiftAbove,
          shiftBelow,
          isReachableByScrolling: isFreeAfter(shiftAbove) || isFreeAfter(shiftBelow),
        },
      ];
    });
  }, box);
}

export function transientFrames(count: number): readonly StreamFrame[] {
  return Array.from({ length: count }, (_, index) => textDeltaTransientFrame(`Részlet ${String(index + 1)}`));
}

/**
 * A lapon létrejövő `EventSource` példányok rögzítése a betöltés ELŐTT, az
 * `sse-real-server.spec.ts` `installStepRunFetchCounter` mintájára, és a kézbesítő függvény
 * (`e2eDeliverFrameWithNextClick`) telepítése. A példány a natív osztály
 * leszármazottja, tehát minden viselkedése a natívé; a kézbesített keret
 * alakja a hálózatié (`encodeStreamFrame`: az `event` név és a `data` a keret
 * JSON-ja), és csak a nyitott példányokra megy.
 */
export async function captureEventSources(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const sources: EventSource[] = [];
    const NativeEventSource = EventSource;
    class CapturedEventSource extends NativeEventSource {
      constructor(...parameters: ConstructorParameters<typeof EventSource>) {
        super(...parameters);
        sources.push(this);
      }
    }
    const deliverFrame = (type: string, data: string): void => {
      for (const source of sources) {
        if (source.readyState === source.OPEN) {
          source.dispatchEvent(new MessageEvent(type, { data }));
        }
      }
    };
    const deliverFrameWithNextClick = (type: string, data: string): void => {
      document.addEventListener(
        'click',
        () => {
          deliverFrame(type, data);
        },
        { capture: true, once: true },
      );
    };
    Object.defineProperties(globalThis, {
      e2eDeliverFrame: { configurable: true, value: deliverFrame },
      e2eDeliverFrameWithNextClick: { configurable: true, value: deliverFrameWithNextClick },
      EventSource: { configurable: true, writable: true, value: CapturedEventSource },
    });
  });
}

/**
 * A React DevTools csatlakozási pontjának (`__REACT_DEVTOOLS_GLOBAL_HOOK__`)
 * telepítése a betöltés ELŐTT, és a kézbesítő függvény
 * (`e2eDeliverFrameOnMeasuredCommit`): a keret PONTOSAN abban a commitban megy
 * ki, amelyikben a lista a kinyitott sor mért magasságával pozicionál (a
 * következő sor, az utolsó sornál a méretező elem, a sor alsó élénél áll), a
 * commit passzív effektjei ELŐTT. A React éles buildje minden commit után
 * hívja az `onCommitFiberRoot` függvényt, a passzív effektek előtt
 * (`react-dom-client.production.js`, `flushSpawnedWork`); a mérő eszköz
 * (`measurement/transcript-scroll.ts`) ugyanezt a pontot használja. Időzítő
 * nincs: a commit sorrend adja a helyét. A kézbesítés a `captureEventSources`
 * rögzített példányain megy, tehát azt is telepíteni kell.
 */
export async function installMeasuredCommitDelivery(page: Page): Promise<void> {
  await page.addInitScript(() => {
    let deliverIfMeasured: (() => boolean) | undefined;
    const isExpandedRowMeasured = (position: number): boolean => {
      const list = globalThis.document.querySelector('[aria-label="Futás eseményei"]');
      if (list === null) {
        return false;
      }
      const row = list.querySelector(`[role="listitem"][aria-posinset="${CSS.escape(String(position))}"]`);
      const sizer = list.querySelector(':scope > [aria-hidden="true"]');
      if (row === null || sizer === null || row.querySelector('[aria-expanded="true"]') === null) {
        return false;
      }
      const next = list.querySelector(`[role="listitem"][aria-posinset="${CSS.escape(String(position + 1))}"]`);
      const followingTop = next === null ? sizer.getBoundingClientRect().bottom : next.getBoundingClientRect().top;
      return Math.abs(followingTop - row.getBoundingClientRect().bottom) < 0.5;
    };
    Object.defineProperties(globalThis, {
      e2eDeliverFrameOnMeasuredCommit: {
        configurable: true,
        value: (position: number, type: string, data: string) => {
          deliverIfMeasured = () => {
            if (!isExpandedRowMeasured(position)) {
              return false;
            }
            globalThis.e2eDeliverFrame?.(type, data);
            return true;
          };
        },
      },
      __REACT_DEVTOOLS_GLOBAL_HOOK__: {
        configurable: true,
        value: {
          supportsFiber: true,
          inject: () => 1,
          onCommitFiberRoot: () => {
            if (deliverIfMeasured?.() === true) {
              deliverIfMeasured = undefined;
            }
          },
        },
      },
    });
  });
}

/**
 * A következő olyan commitban kézbesíti a keretet, amelyikben a `position`
 * sorszámú, kinyitott sor mért magasságú (`installMeasuredCommitDelivery`).
 */
export async function deliverFrameOnMeasuredCommit(page: Page, position: number, frame: StreamFrame): Promise<void> {
  await page.evaluate(
    ({ rowPosition, type, data }) => {
      globalThis.e2eDeliverFrameOnMeasuredCommit?.(rowPosition, type, data);
    },
    { rowPosition: position, type: frame.event, data: JSON.stringify(frame) },
  );
}

export async function deliverFrameWithNextClick(page: Page, frame: StreamFrame): Promise<void> {
  await page.evaluate(
    ({ type, data }) => {
      globalThis.e2eDeliverFrameWithNextClick?.(type, data);
    },
    { type: frame.event, data: JSON.stringify(frame) },
  );
}

/**
 * A kinyitott sor fejlécének függőleges helye a lista elemének tetejéhez
 * mérve, pixelben. `undefined`, amíg a sor nincs kirajzolva.
 */
export async function headerOffsetInList(list: Locator, position: number): Promise<number | undefined> {
  return list.evaluate((element, rowPosition) => {
    const header = element.querySelector(
      `[role="listitem"][aria-posinset="${CSS.escape(String(rowPosition))}"] [aria-expanded]`,
    );
    if (header === null) {
      return;
    }
    return header.getBoundingClientRect().top - element.getBoundingClientRect().top;
  }, position);
}
