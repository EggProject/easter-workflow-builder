/* eslint-disable unicorn/no-null -- a szintetikus drótszintű fixture-ök nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import type { FetchFunction } from '@easter-workflow-builder/core';
import type { StreamFrame } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RunGraphCanvasProperties } from '../run-graph/RunGraphCanvas.tsx';
import type { SubscribeToStreamFrames } from '../stream-client/subscribe-to-stream-frames.ts';
import { RunViewScreen } from './RunViewScreen.tsx';
import { RUN_VIEW_LAYOUT_STORAGE_KEY } from './run-view-layout.ts';

/**
 * A `RunGraphCanvas` mockolva: ez a spec a `RunViewScreen` SAJÁT felelősségét
 * teszteli (három végpont betöltése, fejléc, morzsasor, nem párosítható
 * lista), a vászon csak olvasható propjait a `RunGraphCanvas.spec.tsx` fedi.
 */
const { capturedCanvasProperties } = vi.hoisted(() => {
  const capturedCanvasProperties: RunGraphCanvasProperties[] = [];
  return { capturedCanvasProperties };
});

vi.mock('../run-graph/RunGraphCanvas.tsx', () => ({
  RunGraphCanvas: (properties: RunGraphCanvasProperties) => {
    capturedCanvasProperties.push(properties);
    return null;
  },
}));

function lastCanvasProperties(): RunGraphCanvasProperties {
  const properties = capturedCanvasProperties.at(-1);
  if (properties === undefined) {
    throw new Error('a teszt nem talált rögzített <RunGraphCanvas> propot');
  }
  return properties;
}

const API_ORIGIN = 'https://api.example.test';

const RUN_DETAIL = {
  id: 'r-3',
  workflowId: 'wf-3',
  status: 'running',
  input: null,
  providerId: 'minimax',
  rootRunId: 'r-1',
  depth: 2,
  workflowAncestry: ['wf-1', 'wf-2', 'wf-3'],
  graphSnapshotHash: 'a'.repeat(64),
  persistedStreamDeltas: false,
  restartedFromRunId: null,
  createdAtMs: 10,
  startedAtMs: 20,
  finishedAtMs: null,
  errorKind: null,
  errorMessage: null,
};

const SNAPSHOT = {
  version: 1,
  sdkVersionPin: '0.1.13',
  workflow: { id: 'wf-3', name: 'Harmadik workflow', description: null },
  nodes: [
    {
      id: 'n-start',
      type: 'start',
      label: 'Indítás',
      position: { x: 0, y: 0 },
      config: { type: 'start', inputFields: [], onUnhandledError: null },
      effectiveProviderId: 'minimax',
    },
  ],
  edges: [],
};

const BASE_STEP_RUN = {
  id: 's-1',
  runId: 'r-3',
  nodeId: 'n-start',
  nodeType: 'start',
  parentStepRunId: null,
  iteration: 0,
  attempt: 1,
  status: 'succeeded',
  providerId: 'minimax',
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
  startedAtMs: 20,
  finishedAtMs: 30,
  createdAtMs: 20,
};

const STREAM_ID = 'stream-1';
const STREAM_REPLAY_LIMIT = 100;

/**
 * A veszteségmentes keret feliratkozás teszt duplikátuma: a feliratkozókat
 * egy halmazban tartja, az `emitFrame` pedig mindegyiknek átadja a keretet,
 * ugyanúgy, mint a `useStreamConnection` kezelője.
 */
const frameListeners = new Set<(frame: StreamFrame) => void>();

const subscribeToFrames: SubscribeToStreamFrames = (listener) => {
  frameListeners.add(listener);
  return () => {
    frameListeners.delete(listener);
  };
};

function emitFrame(frame: StreamFrame): void {
  for (const listener of frameListeners) {
    listener(frame);
  }
}

interface FetchOverrides {
  readonly runDetail?: unknown;
  readonly snapshot?: unknown;
  readonly stepRuns?: unknown;
  /**
   * A `GET /api/runs/{runId}` hívások naplója: a `run_finished` keretre
   * kiváltott újratöltés ebből mérhető.
   */
  readonly runDetailUrls?: string[];
  /**
   * A `PUT /api/streams/{streamId}/subscriptions` hívások törzsei.
   */
  readonly subscriptionBodies?: string[];
  /**
   * A `GET /api/runs/{runId}/steps` egymás utáni válaszai (T-009-25a): a
   * hívások sorban kapják az elemeit, az utolsó ismétlődik; egy `Error` elem
   * hálózati hibát szimulál, egy `HttpStatus` elem üres törzsű hibaválaszt ad.
   * Ha meg van adva, a `stepRuns` mező nem számít.
   */
  readonly stepRunResponses?: readonly unknown[];
  /**
   * A `GET /api/runs/{runId}` egymás utáni válaszai, a `stepRunResponses`
   * szabályai szerint. Ha meg van adva, a `runDetail` mező nem számít.
   */
  readonly runDetailResponses?: readonly unknown[];
  /**
   * A `GET /api/runs/{runId}/snapshot` válaszának felülírása egy hibaválasszal.
   */
  readonly snapshotStatus?: HttpStatus;
  /**
   * A `GET /api/runs/{runId}/steps` hívások naplója.
   */
  readonly stepRunUrls?: string[];
  /**
   * A `GET /api/runs/{runId}/snapshot` hívások naplója.
   */
  readonly snapshotUrls?: string[];
  /**
   * A `GET /api/approvals` válasza (T-009-27). Alapértelmezésben üres lista,
   * hogy a többi teszt ne törődjön a jóváhagyás panellel.
   */
  readonly approvals?: unknown;
  /**
   * A `GET /api/approvals` hívások naplója.
   */
  readonly approvalUrls?: string[];
}

/**
 * Egy üres törzsű HTTP hibaválasz státusza a válaszsorozatokban (például a
 * fejlesztői Vite proxy 502-je, amikor a backend nem fogad kapcsolatot).
 */
class HttpStatus {
  readonly status: number;

  constructor(status: number) {
    this.status = status;
  }
}

function respondWith(response: unknown): Promise<Response> {
  if (response instanceof Error) {
    return Promise.reject(response);
  }
  if (response instanceof HttpStatus) {
    return Promise.resolve(new Response('', { status: response.status, headers: { 'Content-Type': 'text/plain' } }));
  }
  return Promise.resolve(Response.json(response));
}

function createFetchFunction(overrides: FetchOverrides = {}): FetchFunction {
  const stepRunResponses = overrides.stepRunResponses ?? [overrides.stepRuns ?? [BASE_STEP_RUN]];
  let stepRunCallCount = 0;
  let runDetailCallCount = 0;
  return (input, init) => {
    const { pathname } = new URL(input);
    if (pathname.endsWith('/subscriptions')) {
      overrides.subscriptionBodies?.push(typeof init.body === 'string' ? init.body : '{}');
      return Promise.resolve(Response.json({ streamId: STREAM_ID, subscriptions: [] }));
    }
    if (pathname.endsWith('/snapshot')) {
      overrides.snapshotUrls?.push(pathname);
      return respondWith(overrides.snapshotStatus ?? overrides.snapshot ?? SNAPSHOT);
    }
    if (pathname.endsWith('/approvals')) {
      overrides.approvalUrls?.push(pathname);
      return respondWith(overrides.approvals ?? []);
    }
    if (pathname.endsWith('/steps')) {
      overrides.stepRunUrls?.push(pathname);
      stepRunCallCount += 1;
      return respondWith(stepRunResponses[Math.min(stepRunCallCount, stepRunResponses.length) - 1]);
    }
    overrides.runDetailUrls?.push(pathname);
    runDetailCallCount += 1;
    const runDetailResponses = overrides.runDetailResponses ?? [overrides.runDetail ?? RUN_DETAIL];
    return respondWith(runDetailResponses[Math.min(runDetailCallCount, runDetailResponses.length) - 1]);
  };
}

const unreachableFetchFunction: FetchFunction = () => Promise.reject(new Error('kapcsolat megszakadt'));

/**
 * A `pending` fázis megfigyeléséhez a kérés SOSEM oldódik fel: egy azonnal
 * teljesülő válasz a teszt törzse UTÁN frissítené az állapotot, amire a React
 * `act(...)` figyelmeztetést ad.
 */
const pendingFetchFunction: FetchFunction = () =>
  new Promise<Response>(() => {
    // szándékosan sosem oldódik fel
  });

/**
 * Egy `run_finished` motor esemény élő SSE kerete a megadott futásra
 * (SPEC-004 13. szekció táblázata).
 */
function runFinishedFrame(runId: string): StreamFrame {
  return {
    event: 'run_event',
    delivery: 'live',
    runEvent: {
      id: 42,
      runId,
      stepRunId: null,
      origin: 'engine',
      kind: 'run_finished',
      occurredAtMs: 50,
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
    },
  };
}

/**
 * Egy `run_interrupted` motor esemény élő SSE kerete a megadott futásra: a
 * szabályos leállás élőben kiadja (SPEC-004 10.2 4. pont).
 */
function runInterruptedFrame(runId: string): StreamFrame {
  const finished = runFinishedFrame(runId);
  if (finished.event !== 'run_event') {
    throw new Error('a teszt run_event keretet vár');
  }
  return {
    ...finished,
    runEvent: { ...finished.runEvent, kind: 'run_interrupted', payload: { reason: 'graceful_shutdown' } },
  };
}

/**
 * Egy lépés szintű motor esemény kerete a nézett futás `s-1` lépés futására
 * (T-009-25a).
 */
function stepEventFrame(
  kind: 'step_started' | 'step_finished',
  delivery: 'live' | 'replayed',
  id: number,
): StreamFrame {
  const finished = runFinishedFrame('r-3');
  if (finished.event !== 'run_event') {
    throw new Error('a teszt run_event keretet vár');
  }
  return { ...finished, delivery, runEvent: { ...finished.runEvent, id, stepRunId: 's-1', kind } };
}

/**
 * A keretek EGYETLEN szinkron sorozatban (egy `act` blokkban, tehát egy
 * React render kötegben), majd a kiváltott kérések lefutása.
 */
async function emitFramesAndFlush(frames: readonly StreamFrame[]): Promise<void> {
  act(() => {
    for (const frame of frames) {
      emitFrame(frame);
    }
  });
  await act(async () => {
    for (let index = 0; index < 8; index += 1) {
      await Promise.resolve();
    }
  });
}

/**
 * Egy `sdk_result` sor pótolt kerete a megadott lépés futáshoz: ennek a
 * sornak a költség megjelenítése függ a lépés providerétől.
 */
function sdkResultFrame(id: number, stepRunId: string): StreamFrame {
  const finished = runFinishedFrame('r-3');
  if (finished.event !== 'run_event') {
    throw new Error('a teszt run_event keretet vár');
  }
  return {
    ...finished,
    delivery: 'replayed',
    runEvent: {
      ...finished.runEvent,
      id,
      stepRunId,
      origin: 'sdk',
      kind: 'sdk_result',
      payload: { type: 'result', total_cost_usd: 0.213108 },
    },
  };
}

describe('RunViewScreen', () => {
  let container: HTMLDivElement;
  let root: Root;
  const navigate = vi.fn();

  beforeEach(() => {
    capturedCanvasProperties.length = 0;
    frameListeners.clear();
    navigate.mockClear();
    globalThis.localStorage.clear();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  /**
   * A fejléc vezérlő sávjának egyetlen gombja: nem terminális futásnál a
   * megszakítás, terminálisnál az újraindítás (`RunControlBar`).
   */
  function headerActionText(): string | null | undefined {
    return container.querySelector(':scope .run-view-screen__header .run-control__actions button')?.textContent;
  }

  async function renderScreen(search: string, fetchFunction: FetchFunction, serverRestartCount = 0): Promise<void> {
    await act(async () => {
      root.render(
        <RunViewScreen
          apiOrigin={API_ORIGIN}
          fetchFunction={fetchFunction}
          search={search}
          navigate={navigate}
          streamId={STREAM_ID}
          subscribeToFrames={subscribeToFrames}
          streamReplayLimit={STREAM_REPLAY_LIMIT}
          serverRestartCount={serverRestartCount}
        />,
      );
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it('runId nélkül a hiányzó query paramétert nevezi meg, kérés nélkül', async () => {
    await renderScreen('', unreachableFetchFunction);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('runId');
  });

  it('betöltés közben csontvázat mutat', () => {
    act(() => {
      root.render(
        <RunViewScreen
          apiOrigin={API_ORIGIN}
          fetchFunction={pendingFetchFunction}
          search="?runId=r-3"
          navigate={navigate}
          streamId={STREAM_ID}
          subscribeToFrames={subscribeToFrames}
          streamReplayLimit={STREAM_REPLAY_LIMIT}
          serverRestartCount={0}
        />,
      );
    });

    expect(container.querySelector('[role="status"]')).not.toBeNull();
    expect(container.querySelectorAll('.skel')).toHaveLength(4);
  });

  it('a betöltés hibájára a hibaüzenetet mutatja', async () => {
    await renderScreen('?runId=r-3', unreachableFetchFunction);
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('A szerver nem érhető el.');
  });

  it('a fejléc kimondja, hogy a rajz pillanatkép, és megnevezi az sdkVersionPin értéket', async () => {
    await renderScreen('?runId=r-3', createFetchFunction());

    const note = container.querySelector('.run-view-screen__snapshot-note');
    expect(note?.textContent).toContain('pillanatkép');
    expect(note?.textContent).toContain('0.1.13');
  });

  it('a több szintű workflowAncestry listából morzsasort rajzol, az utolsó elem az aktuális', async () => {
    await renderScreen('?runId=r-3', createFetchFunction());

    const breadcrumb = container.querySelector('nav.breadcrumb[aria-label="Al-workflow útvonal"]');
    if (breadcrumb === null) {
      throw new Error('a teszt nem talált al-workflow morzsasort');
    }
    const links = [...breadcrumb.querySelectorAll<HTMLAnchorElement>('a.breadcrumb__item')];
    expect(links.map((link) => link.textContent)).toEqual(['wf-1', 'wf-2']);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/editor?workflowId=wf-1',
      '/editor?workflowId=wf-2',
    ]);
    expect(breadcrumb.querySelector('.breadcrumb__item--current')?.textContent).toBe('Harmadik workflow');

    act(() => {
      links[0]?.click();
    });
    expect(navigate).toHaveBeenCalledWith('graphEditor', 'workflowId=wf-1');
  });

  it('egyelemű workflowAncestry esetén nincs ős link', async () => {
    await renderScreen('?runId=r-3', createFetchFunction({ runDetail: { ...RUN_DETAIL, workflowAncestry: ['wf-3'] } }));

    const breadcrumb = container.querySelector('nav.breadcrumb[aria-label="Al-workflow útvonal"]');
    expect(breadcrumb?.querySelectorAll('a.breadcrumb__item')).toHaveLength(0);
  });

  it('a pillanatképet a vászonnak adja, a párosított állapottal', async () => {
    await renderScreen('?runId=r-3', createFetchFunction());

    const properties = lastCanvasProperties();
    expect(properties.nodes.map((node) => node.workflowNode.id)).toEqual(['n-start']);
    expect(properties.nodes[0]?.status).toBe('succeeded');
    expect(container.querySelector('.unmatched-step-run-list')).toBeNull();
  });

  it('a nem párosítható lépés futásokat a gráf alatt, listás alakban mutatja', async () => {
    await renderScreen(
      '?runId=r-3',
      createFetchFunction({
        stepRuns: [BASE_STEP_RUN, { ...BASE_STEP_RUN, id: 's-2', nodeId: 'n-torolt', nodeType: 'agent_step' }],
      }),
    );

    const list = container.querySelector('.unmatched-step-run-list');
    if (list === null) {
      throw new Error('a teszt nem talált nem párosítható lista szakaszt');
    }
    expect(list.textContent).toContain('n-torolt');
    expect(list.querySelectorAll('li')).toHaveLength(1);
  });

  it('a sub_workflow csomópont összesítésének navigációja ugyanerre a képernyőre visz, másik runId paraméterrel', async () => {
    await renderScreen(
      '?runId=r-3',
      createFetchFunction({
        snapshot: {
          ...SNAPSHOT,
          nodes: [
            {
              id: 'n-sub',
              type: 'sub_workflow',
              label: 'Al-workflow',
              position: { x: 0, y: 0 },
              config: { type: 'sub_workflow', targetWorkflowId: 'wf-9', inputMapping: {}, onUnhandledError: null },
              effectiveProviderId: 'minimax',
            },
          ],
        },
        stepRuns: [{ ...BASE_STEP_RUN, nodeId: 'n-sub', nodeType: 'sub_workflow', subWorkflowRunId: 'r-9' }],
      }),
    );

    const decoration = lastCanvasProperties().nodes[0]?.runDecoration;
    if (decoration === undefined) {
      throw new Error('a teszt nem talált futás összesítést a sub_workflow csomóponton');
    }
    expect(decoration.summary).toEqual({ kind: 'sub_workflow', subWorkflowRunId: 'r-9' });

    decoration.onOpenSubWorkflowRun('r-9');
    expect(navigate).toHaveBeenCalledWith('runView', 'runId=r-9');
  });

  it('a rajz és a transcript panel az osztott elrendezésben áll, húzható elválasztóval', async () => {
    // A happy-dom `innerWidth` alapértéke 1024, ami a --ep-screen-lg token
    // értéke, tehát a hook a vízszintes sávot választja: ez a képernyő
    // ALAPESETE. A három sáv elrendezését a `RunViewLayout.spec.tsx`, a sáv
    // választást a `use-run-view-layout-band.spec.tsx` fedi.
    await renderScreen('?runId=r-3', createFetchFunction());

    const body = container.querySelector('.run-view-screen__body');
    expect(body?.querySelector('.resizable-group')).not.toBeNull();
    expect(container.querySelector('.run-view-screen__graph')).not.toBeNull();
    expect(container.querySelector(':scope .run-view-screen__transcript .transcript-panel')).not.toBeNull();
    expect(container.querySelector('[role="separator"]')?.getAttribute('aria-orientation')).toBe('vertical');
  });

  describe('a transcript panel (T-009-25)', () => {
    it('a helykitöltő helyén a panel áll, és a pótlás lezárulta előtt a betöltést jelzi', async () => {
      await renderScreen('?runId=r-3', createFetchFunction());

      const panel = container.querySelector(':scope .run-view-screen__transcript .transcript-panel');
      expect(panel?.querySelector('[role="status"]')?.textContent).toBe('Előzmények betöltése');
      expect(panel?.querySelectorAll('.skel').length).toBeGreaterThan(0);
      expect(container.textContent).not.toContain('A futás eseményei itt jelennek meg.');
    });

    it('minden sort a RunEventRow rajzol, a lépés futás providerId mezője szerint: MiniMax mellett nincs költség', async () => {
      await renderScreen('?runId=r-3', createFetchFunction({ stepRuns: [BASE_STEP_RUN] }));
      act(() => {
        emitFrame(sdkResultFrame(1, 's-1'));
        emitFrame({ event: 'replay_complete', runId: 'r-3', throughEventId: 1 });
      });

      const rows = container.querySelectorAll(':scope .transcript-panel [role="listitem"] .run-event-row');
      expect(rows).toHaveLength(1);
      expect(rows[0]?.querySelector('.accordion__meta')).toBeNull();
      expect(rows[0]?.textContent).not.toContain('$0.2131');
    });

    it('claude-subscription providerű lépés sorában a költség a meta szlotban látszik', async () => {
      await renderScreen(
        '?runId=r-3',
        createFetchFunction({ stepRuns: [{ ...BASE_STEP_RUN, providerId: 'claude-subscription' }] }),
      );
      act(() => {
        emitFrame(sdkResultFrame(1, 's-1'));
      });

      const meta = container.querySelector(':scope .transcript-panel .run-event-row .accordion__meta');
      expect(meta?.textContent).toBe('$0.2131');
    });

    it('a képernyő betöltése ALATT érkező keretek sem vesznek el: a feliratkozás a betöltési ágak előtt él', async () => {
      const pendingResolvers: (() => void)[] = [];
      const baseFetch = createFetchFunction();
      const deferredFetch: FetchFunction = (input, init) =>
        new Promise<Response>((resolve) => {
          pendingResolvers.push(() => {
            void baseFetch(input, init).then(resolve);
          });
        });

      act(() => {
        root.render(
          <RunViewScreen
            apiOrigin={API_ORIGIN}
            fetchFunction={deferredFetch}
            search="?runId=r-3"
            navigate={navigate}
            streamId={STREAM_ID}
            subscribeToFrames={subscribeToFrames}
            streamReplayLimit={STREAM_REPLAY_LIMIT}
            serverRestartCount={0}
          />,
        );
      });
      expect(container.querySelector('.run-view-screen__loading')).not.toBeNull();
      act(() => {
        emitFrame(sdkResultFrame(1, 's-1'));
        emitFrame(sdkResultFrame(2, 's-1'));
      });

      await act(async () => {
        for (const resolvePending of pendingResolvers) {
          resolvePending();
        }
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(container.querySelectorAll(':scope .transcript-panel .run-event-row')).toHaveLength(2);
    });

    it.each([
      { persistedStreamDeltas: false, isNoteShown: true },
      { persistedStreamDeltas: true, isNoteShown: false },
    ])(
      'a delta mondat a futás RunDetail.persistedStreamDeltas mezőjéből jön: $persistedStreamDeltas mellett látszik: $isNoteShown (T-009-26)',
      async ({ persistedStreamDeltas, isNoteShown }) => {
        await renderScreen('?runId=r-3', createFetchFunction({ runDetail: { ...RUN_DETAIL, persistedStreamDeltas } }));

        const note = container.querySelector(':scope .transcript-panel .transcript-panel__delta-note');
        expect(note !== null).toBe(isNoteShown);
      },
    );

    it('az élő átmeneti keret megjelölt sort ad, és az utána érkező tárolt sort nem nyeli el (T-009-26)', async () => {
      await renderScreen('?runId=r-3', createFetchFunction());
      act(() => {
        emitFrame(sdkResultFrame(1, 's-1'));
        emitFrame({ event: 'replay_complete', runId: 'r-3', throughEventId: 1 });
        emitFrame({
          event: 'run_event_transient',
          runId: 'r-3',
          stepRunId: 's-1',
          kind: 'sdk_stream_event',
          occurredAtMs: 30,
          payload: {
            type: 'stream_event',
            event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hel' } },
          },
        });
        emitFrame(sdkResultFrame(2, 's-1'));
      });

      const rows = [...container.querySelectorAll(':scope .transcript-panel [role="listitem"] .run-event-row')];
      expect(rows).toHaveLength(3);
      expect(rows.map((row) => row.querySelector('.badge')?.textContent)).toEqual([undefined, 'Nem tárolt', undefined]);
    });

    it('leszereléskor leiratkozik a keretekről', async () => {
      await renderScreen('?runId=r-3', createFetchFunction());
      // Négy feliratkozó: a transcript, a csomópontok élő állapota, a futás
      // lezárásának felismerése (T-009-25, T-009-25a) és a függő
      // jóváhagyások élő listája (T-009-27).
      expect(frameListeners.size).toBe(4);
      act(() => {
        root.unmount();
      });
      expect(frameListeners.size).toBe(0);
      // Az `afterEach` újra leszerelné a gyökeret: egy friss, üres gyökér
      // kerül a helyére, hogy a második `unmount` ne dobjon.
      root = createRoot(container);
    });
  });

  it('a tárolt elrendezés arányt betölti, és a Resizable kezdő értesítését visszaírja', async () => {
    globalThis.localStorage.setItem(RUN_VIEW_LAYOUT_STORAGE_KEY, JSON.stringify([40, 60]));
    await renderScreen('?runId=r-3', createFetchFunction());

    expect(container.querySelector('[role="separator"]')?.getAttribute('aria-valuenow')).toBe('40');
    expect(globalThis.localStorage.getItem(RUN_VIEW_LAYOUT_STORAGE_KEY)).toBe('[40,60]');
  });

  it('érvénytelen pillanatkép alakra a hibás mező útvonalát mutatja, rajz nélkül', async () => {
    await renderScreen(
      '?runId=r-3',
      createFetchFunction({
        snapshot: {
          ...SNAPSHOT,
          nodes: [
            {
              id: 'n-loop',
              type: 'loop',
              label: 'Ciklus',
              position: { x: 0, y: 0 },
              config: { type: 'loop', continueExpression: 'i < 2', onUnhandledError: null },
              effectiveProviderId: 'minimax',
            },
          ],
        },
      }),
    );

    expect(container.querySelector('[role="alert"]')?.textContent).toContain('maxIterations');
    expect(capturedCanvasProperties).toHaveLength(0);
  });

  // ============================================================
  // A FUTÁS VEZÉRLÉSE ÉS AZ ÉLŐ ÁLLAPOT (T-009-23, SPEC-008 6.4, 6.5).
  // ============================================================

  it('a fejlécben áll a futás vezérlő sávja, az állapot jelvényével', async () => {
    await renderScreen('?runId=r-3', createFetchFunction());

    const control = container.querySelector(':scope .run-view-screen__header .run-control');
    expect(control?.querySelector('.badge')?.textContent).toBe('fut');
    expect(control?.querySelector(':scope .run-control__actions button')?.textContent).toBe('Megszakítás');
  });

  it('feliratkozik a nézett futásra az app szintű stream kapcsolaton', async () => {
    const subscriptionBodies: string[] = [];
    await renderScreen('?runId=r-3', createFetchFunction({ subscriptionBodies }));

    expect(subscriptionBodies).toEqual([
      JSON.stringify({ runs: [{ runId: 'r-3', fromEventId: 0, replayLimit: STREAM_REPLAY_LIMIT }] }),
    ]);
  });

  it('a saját futás run_finished keretére újratölti a futás rekordját', async () => {
    const runDetailUrls: string[] = [];
    await renderScreen('?runId=r-3', createFetchFunction({ runDetailUrls }));
    expect(runDetailUrls).toHaveLength(1);

    await emitFramesAndFlush([runFinishedFrame('r-3')]);

    expect(runDetailUrls).toHaveLength(2);
  });

  it('másik futás run_finished keretére nem tölt újra', async () => {
    const runDetailUrls: string[] = [];
    await renderScreen('?runId=r-3', createFetchFunction({ runDetailUrls }));

    await emitFramesAndFlush([runFinishedFrame('r-99')]);

    expect(runDetailUrls).toHaveLength(1);
  });

  it('a run_finished keret akkor is újratölt, ha UGYANABBAN a löketben replay_complete követi (T-009-25a)', async () => {
    // A szerver a pótlás végén szinkron küldi a `replay_complete` keretet
    // (`apps/server` `handle-stream-connection.ts` `replayRun`): egy "utolsó
    // keret" alakú állapot ebből a löketből csak a `replay_complete` keretet
    // adná át, és a fejléc "fut" állapotban ragadna.
    const runDetailUrls: string[] = [];
    await renderScreen('?runId=r-3', createFetchFunction({ runDetailUrls }));

    await emitFramesAndFlush([runFinishedFrame('r-3'), { event: 'replay_complete', runId: 'r-3', throughEventId: 42 }]);

    expect(runDetailUrls).toHaveLength(2);
  });

  it('a saját futás run_interrupted keretére is újratölti a futás rekordját, és a fejléc az újraindítást kínálja', async () => {
    const runDetailUrls: string[] = [];
    const overrides: { runDetail: unknown; runDetailUrls: string[] } = { runDetail: RUN_DETAIL, runDetailUrls };
    await renderScreen('?runId=r-3', createFetchFunction(overrides));
    expect(headerActionText()).toBe('Megszakítás');

    // A szerver oldali futás a keret kiadása ELŐTT már `interrupted`
    // (SPEC-004 10.2 3. és 4. pont: előbb a `markRunInterrupted`, utána a
    // kiadás).
    overrides.runDetail = { ...RUN_DETAIL, status: 'interrupted', finishedAtMs: 40 };
    await emitFramesAndFlush([runInterruptedFrame('r-3')]);

    expect(runDetailUrls).toHaveLength(2);
    expect(container.querySelector(':scope .run-view-screen__header .run-control .badge')?.textContent).toBe(
      'félbeszakítva',
    );
    expect(headerActionText()).toBe('Újraindítás');
  });

  it('másik futás run_interrupted keretére nem tölt újra', async () => {
    const runDetailUrls: string[] = [];
    await renderScreen('?runId=r-3', createFetchFunction({ runDetailUrls }));

    await emitFramesAndFlush([runInterruptedFrame('r-99')]);

    expect(runDetailUrls).toHaveLength(1);
  });

  it('az újratöltés alatt a rajz a helyén marad, csontváz nélkül', async () => {
    const runDetailUrls: string[] = [];
    await renderScreen('?runId=r-3', createFetchFunction({ runDetailUrls }));

    // A keret megérkezése a futás rekordjának újratöltését indítja: a
    // kérés `pending`, de a KORÁBBI rekord a helyén marad, tehát a rajz nem
    // villog.
    act(() => {
      emitFrame(runFinishedFrame('r-3'));
    });

    expect(runDetailUrls).toHaveLength(2);
    expect(container.querySelector('.run-view-screen__loading')).toBeNull();
    expect(container.querySelector('.run-view-screen__header')).not.toBeNull();
  });

  // ============================================================
  // SZERVER ÚJRAINDULÁS (SPEC-005 5.2, SPEC-007 AC44).
  // ============================================================

  it('a serverRestartCount növekedésére újra feliratkozik, újratölti a futást és a lépéseket, a pillanatképet nem', async () => {
    const subscriptionBodies: string[] = [];
    const runDetailUrls: string[] = [];
    const stepRunUrls: string[] = [];
    const snapshotUrls: string[] = [];
    // Kizárólag a `runDetail` mező írható: a teszt a szerver oldali futás
    // állapotát a második betöltés előtt átírja.
    const overrides: Omit<FetchOverrides, 'runDetail'> & { runDetail: unknown } = {
      runDetail: RUN_DETAIL,
      subscriptionBodies,
      runDetailUrls,
      stepRunUrls,
      snapshotUrls,
      stepRunResponses: [[{ ...BASE_STEP_RUN, status: 'running' }], [{ ...BASE_STEP_RUN, status: 'interrupted' }]],
    };
    const fetchFunction = createFetchFunction(overrides);
    await renderScreen('?runId=r-3', fetchFunction, 0);
    expect([subscriptionBodies, runDetailUrls, stepRunUrls, snapshotUrls].map((log) => log.length)).toEqual([
      1, 1, 1, 1,
    ]);
    expect(lastCanvasProperties().nodes[0]?.status).toBe('running');

    // Az indulási helyreállítás a futást és a nem terminális lépést
    // `interrupted` állapotba vitte (SPEC-004 10.1), a feliratkozás pedig a
    // szerver memóriájával együtt elveszett.
    overrides.runDetail = { ...RUN_DETAIL, status: 'interrupted', finishedAtMs: 40 };
    await renderScreen('?runId=r-3', fetchFunction, 1);

    expect(subscriptionBodies).toEqual([
      JSON.stringify({ runs: [{ runId: 'r-3', fromEventId: 0, replayLimit: STREAM_REPLAY_LIMIT }] }),
      JSON.stringify({ runs: [{ runId: 'r-3', fromEventId: 0, replayLimit: STREAM_REPLAY_LIMIT }] }),
    ]);
    expect(runDetailUrls).toHaveLength(2);
    expect(stepRunUrls).toHaveLength(2);
    expect(snapshotUrls).toHaveLength(1);
    expect(lastCanvasProperties().nodes[0]?.status).toBe('interrupted');
    expect(headerActionText()).toBe('Újraindítás');
  });

  it('a szerver újraindulás utáni újratöltés alatt a rajz a helyén marad, csontváz nélkül', async () => {
    const stepRunUrls: string[] = [];
    const fetchFunction = createFetchFunction({ stepRunUrls });
    await renderScreen('?runId=r-3', fetchFunction, 0);

    // Ugyanaz a `fetchFunction` példány: kizárólag a számláló változik.
    act(() => {
      root.render(
        <RunViewScreen
          apiOrigin={API_ORIGIN}
          fetchFunction={fetchFunction}
          search="?runId=r-3"
          navigate={navigate}
          streamId={STREAM_ID}
          subscribeToFrames={subscribeToFrames}
          streamReplayLimit={STREAM_REPLAY_LIMIT}
          serverRestartCount={1}
        />,
      );
    });

    expect(stepRunUrls).toHaveLength(2);
    expect(container.querySelector('.run-view-screen__loading')).toBeNull();
    expect(container.querySelector('.run-view-screen__header')).not.toBeNull();
  });

  // ============================================================
  // A CSOMÓPONTOK ÉLŐ ÁLLAPOTA (T-009-25a, SPEC-008 6.2).
  // ============================================================

  it('élő step_started keretre a csomópont állapota újratöltés után frissül, oldal újratöltés nélkül', async () => {
    const stepRunUrls: string[] = [];
    const stepRunResponses = [[{ ...BASE_STEP_RUN, status: 'pending' }], [{ ...BASE_STEP_RUN, status: 'running' }]];
    await renderScreen('?runId=r-3', createFetchFunction({ stepRunResponses, stepRunUrls }));
    expect(lastCanvasProperties().nodes[0]?.status).toBe('pending');

    await emitFramesAndFlush([stepEventFrame('step_started', 'live', 43)]);

    expect(stepRunUrls).toHaveLength(2);
    expect(lastCanvasProperties().nodes[0]?.status).toBe('running');
  });

  it('a lépés futások újratöltésének hibáját a képernyő helyén mutatja', async () => {
    await renderScreen('?runId=r-3', createFetchFunction({ stepRunResponses: [new Error('kapcsolat megszakadt')] }));

    expect(container.querySelector('[role="alert"]')?.textContent).toBe('A szerver nem érhető el.');
  });

  // ============================================================
  // ÁTMENETI HIBA ÚJRATÖLTÉSKOR: A SZERVER LEÁLLÁSA (2026-09-23).
  //
  // A szabályos leállás `run_interrupted` kerete még a nyitott SSE
  // kapcsolaton érkezik, de a rá indított újratöltést a szerver már nem
  // fogadja: a fejlesztői Vite proxy 502-t ad. A mért hiba: a teljes futás
  // nézet helyén a "HTTP 502" riasztás állt az újraindulásig.
  // ============================================================

  /**
   * A szerverre várakozás jelzése (`Alert`, `role="status"`), vagy `null`.
   */
  function serverWaitStatus(): Element | null {
    return container.querySelector('.run-view-screen__server-wait[role="status"]');
  }

  it('a run_interrupted keretre indított újratöltés 502 válasza mellett a rajz, a fejléc és a transcript a helyén marad, és várakozás jelzés jelenik meg', async () => {
    const runDetailUrls: string[] = [];
    await renderScreen(
      '?runId=r-3',
      createFetchFunction({
        runDetailUrls,
        runDetailResponses: [RUN_DETAIL, new HttpStatus(502)],
        stepRunResponses: [[{ ...BASE_STEP_RUN, status: 'running' }], new HttpStatus(502)],
      }),
    );
    expect(serverWaitStatus()).toBeNull();

    await emitFramesAndFlush([runInterruptedFrame('r-3')]);

    expect(runDetailUrls).toHaveLength(2);
    expect(container.querySelector('p[role="alert"]')).toBeNull();
    expect(container.querySelector('.run-view-screen__header')).not.toBeNull();
    expect(headerActionText()).toBe('Megszakítás');
    expect(lastCanvasProperties().nodes[0]?.status).toBe('running');
    expect(container.querySelector(':scope .run-view-screen__transcript .transcript-panel')).not.toBeNull();
    expect(container.querySelector(':scope .transcript-panel .run-event-row')?.textContent).toContain(
      'Futás félbeszakítva',
    );
    const status = serverWaitStatus();
    expect(status?.querySelector('.alert__title')?.textContent).toBe('Várakozás a szerverre');
    expect(status?.querySelector('.alert__message')?.textContent).toContain(
      'A szerver hibás választ adott (HTTP 502).',
    );
    expect(status?.classList.contains('alert--warning')).toBe(true);
  });

  it('a szerver újraindulása utáni sikeres újratöltés leveszi a várakozás jelzést, és a nézet a lezárt futást mutatja', async () => {
    const fetchFunction = createFetchFunction({
      runDetailResponses: [RUN_DETAIL, new HttpStatus(502), { ...RUN_DETAIL, status: 'interrupted', finishedAtMs: 40 }],
      stepRunResponses: [
        [{ ...BASE_STEP_RUN, status: 'running' }],
        new HttpStatus(502),
        [{ ...BASE_STEP_RUN, status: 'interrupted' }],
      ],
    });
    await renderScreen('?runId=r-3', fetchFunction, 0);
    await emitFramesAndFlush([runInterruptedFrame('r-3')]);
    expect(serverWaitStatus()).not.toBeNull();

    await renderScreen('?runId=r-3', fetchFunction, 1);

    expect(serverWaitStatus()).toBeNull();
    expect(lastCanvasProperties().nodes[0]?.status).toBe('interrupted');
    expect(headerActionText()).toBe('Újraindítás');
  });

  it('ha a szerver nem jön vissza, a várakozás jelzés a további sikertelen újratöltések után is látszik, a rajz mellett', async () => {
    await renderScreen(
      '?runId=r-3',
      createFetchFunction({
        runDetailResponses: [RUN_DETAIL, new Error('kapcsolat megszakadt')],
        stepRunResponses: [[BASE_STEP_RUN], new Error('kapcsolat megszakadt')],
      }),
    );

    await emitFramesAndFlush([runInterruptedFrame('r-3')]);
    await emitFramesAndFlush([stepEventFrame('step_finished', 'live', 44)]);

    expect(serverWaitStatus()?.querySelector('.alert__message')?.textContent).toContain('A szerver nem érhető el.');
    expect(container.querySelector('p[role="alert"]')).toBeNull();
    expect(lastCanvasProperties().nodes[0]?.status).toBe('succeeded');
  });

  it('csak a lépés futások átmeneti újratöltési hibája is a rajz mellett jelez, nem a helyén', async () => {
    await renderScreen('?runId=r-3', createFetchFunction({ stepRunResponses: [[BASE_STEP_RUN], new HttpStatus(503)] }));

    await emitFramesAndFlush([stepEventFrame('step_finished', 'live', 44)]);

    expect(container.querySelector('p[role="alert"]')).toBeNull();
    expect(serverWaitStatus()?.querySelector('.alert__message')?.textContent).toContain('HTTP 503');
  });

  it('nem átmeneti újratöltési hiba (HTTP 500) továbbra is a képernyő helyén áll', async () => {
    await renderScreen('?runId=r-3', createFetchFunction({ runDetailResponses: [RUN_DETAIL, new HttpStatus(500)] }));

    await emitFramesAndFlush([runInterruptedFrame('r-3')]);

    expect(container.querySelector('p[role="alert"]')?.textContent).toBe('A szerver hibás választ adott (HTTP 500).');
    expect(container.querySelector('.run-view-screen__header')).toBeNull();
    expect(serverWaitStatus()).toBeNull();
  });

  it('az első betöltés átmeneti hibája a képernyő helyén áll, mert nincs korábbi állapot', async () => {
    await renderScreen('?runId=r-3', createFetchFunction({ runDetailResponses: [new HttpStatus(502)] }));

    expect(container.querySelector('p[role="alert"]')?.textContent).toBe('A szerver hibás választ adott (HTTP 502).');
    expect(serverWaitStatus()).toBeNull();
  });

  it('a pillanatkép betöltésének hibája a képernyő helyén áll', async () => {
    await renderScreen('?runId=r-3', createFetchFunction({ snapshotStatus: new HttpStatus(502) }));

    expect(container.querySelector('p[role="alert"]')?.textContent).toBe('A szerver hibás választ adott (HTTP 502).');
    expect(capturedCanvasProperties).toHaveLength(0);
  });

  it('másik futásra váltva a korábbi futás rekordja nem marad az új futás átmeneti hibája mellett', async () => {
    const fetchFunction = createFetchFunction({ runDetailResponses: [RUN_DETAIL, new HttpStatus(502)] });
    await renderScreen('?runId=r-3', fetchFunction);
    expect(headerActionText()).toBe('Megszakítás');

    // Az új futás rekordjának ELSŐ betöltése bukik átmenetileg: korábbi
    // értéke nincs, tehát a képernyő helyén a hiba áll, nem a régi futás
    // fejléce.
    await renderScreen('?runId=r-4', fetchFunction);

    expect(container.querySelector('p[role="alert"]')?.textContent).toBe('A szerver hibás választ adott (HTTP 502).');
    expect(container.querySelector('.run-view-screen__header')).toBeNull();
  });

  const APPROVAL_NODE_SNAPSHOT = {
    ...SNAPSHOT,
    nodes: [
      ...SNAPSHOT.nodes,
      {
        id: 'n-approval',
        type: 'human_approval',
        label: 'Jóváhagyás',
        position: { x: 100, y: 0 },
        config: {
          type: 'human_approval',
          title: 'Engedélyezed?',
          bodyTemplate: 'Kérlek erősítsd meg',
          timeoutMs: null,
          onUnhandledError: null,
        },
        effectiveProviderId: 'minimax',
      },
    ],
  };

  const APPROVAL_STEP_RUN = {
    ...BASE_STEP_RUN,
    id: 's-approval',
    nodeId: 'n-approval',
    nodeType: 'human_approval',
    status: 'waiting_approval',
  };

  const APPROVAL = {
    id: 'a-1',
    runId: 'r-3',
    stepRunId: 's-approval',
    title: 'Engedélyezed?',
    body: 'Kérlek erősítsd meg',
    payload: { amount: 5 },
    decision: null,
    requestedAtMs: 1000,
    decidedAtMs: null,
  };

  it('a jóváhagyás panel a GET /api/approvals válaszából épül, a saját runId értékére szűrve', async () => {
    const otherRunApproval = { ...APPROVAL, id: 'a-2', runId: 'r-9', stepRunId: 's-other' };
    await renderScreen(
      '?runId=r-3',
      createFetchFunction({
        snapshot: APPROVAL_NODE_SNAPSHOT,
        stepRuns: [BASE_STEP_RUN, APPROVAL_STEP_RUN],
        approvals: [APPROVAL, otherRunApproval],
      }),
    );

    const cards = container.querySelectorAll('.approval-prompt-card');
    expect(cards).toHaveLength(1);
    expect(cards[0]?.textContent).toContain('Engedélyezed?');
    // A jelzés a fejléc vezérlő sávjában, a panel a transcript sávban, a
    // transcript fölött áll (PLAN-009 5. szekció F6), nem a vászon fölött.
    expect(container.querySelector(':scope .run-view-screen__header .run-control__bar')?.textContent).toContain(
      'jóváhagyásra vár',
    );
    const transcriptSide = container.querySelector('.run-view-screen__transcript');
    expect(transcriptSide?.firstElementChild?.className).toBe('approval-prompt-panel');
    expect(transcriptSide?.querySelector(':scope > .approval-prompt-panel + .transcript-panel')).not.toBeNull();
    expect(container.querySelector(':scope .run-view-screen > .approval-prompt-panel')).toBeNull();
  });

  it('nulla függő jóváhagyásra nincs fejléc jelvény és nincs jóváhagyás kártya', async () => {
    await renderScreen('?runId=r-3', createFetchFunction({}));

    expect(container.querySelector(':scope .run-view-screen__header .run-control__bar')?.textContent).not.toContain(
      'jóváhagyásra vár',
    );
    expect(container.querySelector('.approval-prompt-card')).toBeNull();
  });

  it('a jóváhagyás lista első betöltésének hibájára a panel a hibát mutatja, betöltés jelzés nélkül, a rajz pedig a helyén marad', async () => {
    await renderScreen('?runId=r-3', createFetchFunction({ approvals: new HttpStatus(500) }));

    const panel = container.querySelector(':scope .run-view-screen__transcript > .approval-prompt-panel');
    expect(panel?.querySelector('[role="alert"]')).not.toBeNull();
    expect(panel?.querySelector('[role="progressbar"]')).toBeNull();
    expect(lastCanvasProperties().nodes).toHaveLength(1);
  });

  it('élő approval_requested keretre a jóváhagyás lista újratöltődik, és a kártya oldal újratöltés nélkül megjelenik', async () => {
    const approvalUrls: string[] = [];
    let approvals: readonly unknown[] = [];
    const baseFetchFunction = createFetchFunction({
      snapshot: APPROVAL_NODE_SNAPSHOT,
      stepRuns: [BASE_STEP_RUN, APPROVAL_STEP_RUN],
    });
    const fetchFunction: FetchFunction = (input, init) => {
      const { pathname } = new URL(input);
      if (!pathname.endsWith('/approvals')) {
        return baseFetchFunction(input, init);
      }
      approvalUrls.push(pathname);
      return Promise.resolve(Response.json(approvals));
    };
    await renderScreen('?runId=r-3', fetchFunction);
    expect(container.querySelector('.approval-prompt-card')).toBeNull();
    expect(approvalUrls).toHaveLength(1);

    approvals = [APPROVAL];
    const requested = runFinishedFrame('r-3');
    if (requested.event !== 'run_event') {
      throw new Error('a teszt run_event keretet vár');
    }
    await emitFramesAndFlush([{ ...requested, runEvent: { ...requested.runEvent, kind: 'approval_requested' } }]);

    expect(approvalUrls).toHaveLength(2);
    expect(container.querySelectorAll('.approval-prompt-card')).toHaveLength(1);
  });

  it('a rajzon a human_approval csomópont a waiting_approval összesítést kapja a PendingApproval.requestedAtMs értékével', async () => {
    await renderScreen(
      '?runId=r-3',
      createFetchFunction({
        snapshot: APPROVAL_NODE_SNAPSHOT,
        stepRuns: [BASE_STEP_RUN, APPROVAL_STEP_RUN],
        approvals: [APPROVAL],
      }),
    );

    const approvalNode = lastCanvasProperties().nodes.find((node) => node.workflowNode.id === 'n-approval');
    expect(approvalNode?.runDecoration?.summary).toEqual({ kind: 'waiting_approval', requestedAtMs: 1000 });
  });

  it('egy conflict döntés után a jóváhagyás lista frissül', async () => {
    const decisionUrls: string[] = [];
    const approvalUrls: string[] = [];
    const baseFetchFunction = createFetchFunction({
      snapshot: APPROVAL_NODE_SNAPSHOT,
      stepRuns: [BASE_STEP_RUN, APPROVAL_STEP_RUN],
      approvals: [APPROVAL],
      approvalUrls,
    });
    const fetchFunction: FetchFunction = (input, init) => {
      const { pathname } = new URL(input);
      if (pathname.endsWith('/decision')) {
        decisionUrls.push(typeof init.body === 'string' ? init.body : '{}');
        return Promise.resolve(
          Response.json({ code: 'conflict', message: 'a jóváhagyás már el lett döntve' }, { status: 409 }),
        );
      }
      return baseFetchFunction(input, init);
    };
    await renderScreen('?runId=r-3', fetchFunction);

    const approveButton = [
      ...container.querySelectorAll<HTMLButtonElement>(':scope .approval-decision-row button.btn'),
    ].find((button) => button.textContent === 'Jóváhagyás');
    if (approveButton === undefined) {
      throw new Error('a teszt nem talált Jóváhagyás gombot');
    }
    await act(async () => {
      approveButton.click();
      for (let index = 0; index < 8; index += 1) {
        await Promise.resolve();
      }
    });

    expect(decisionUrls).toEqual([JSON.stringify({ decision: 'approved' })]);
    expect(container.querySelector(':scope .approval-decision-row [role="alert"]')?.textContent).toContain(
      'Az elem állapota most nem engedi a műveletet.',
    );
    expect(approvalUrls.length).toBeGreaterThanOrEqual(2);
    // A conflicttel lezárt kártya gombjai nem kapcsolnak vissza.
    expect(approveButton.disabled).toBe(true);
  });
});
