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
   * hálózati hibát szimulál. Ha meg van adva, a `stepRuns` mező nem számít.
   */
  readonly stepRunResponses?: readonly unknown[];
  /**
   * A `GET /api/runs/{runId}/steps` hívások naplója.
   */
  readonly stepRunUrls?: string[];
}

function createFetchFunction(overrides: FetchOverrides = {}): FetchFunction {
  const stepRunResponses = overrides.stepRunResponses ?? [overrides.stepRuns ?? [BASE_STEP_RUN]];
  let stepRunCallCount = 0;
  return (input, init) => {
    const { pathname } = new URL(input);
    if (pathname.endsWith('/subscriptions')) {
      overrides.subscriptionBodies?.push(typeof init.body === 'string' ? init.body : '{}');
      return Promise.resolve(Response.json({ streamId: STREAM_ID, subscriptions: [] }));
    }
    if (pathname.endsWith('/snapshot')) {
      return Promise.resolve(Response.json(overrides.snapshot ?? SNAPSHOT));
    }
    if (pathname.endsWith('/steps')) {
      overrides.stepRunUrls?.push(pathname);
      stepRunCallCount += 1;
      const response = stepRunResponses[Math.min(stepRunCallCount, stepRunResponses.length) - 1];
      return response instanceof Error ? Promise.reject(response) : Promise.resolve(Response.json(response));
    }
    overrides.runDetailUrls?.push(pathname);
    return Promise.resolve(Response.json(overrides.runDetail ?? RUN_DETAIL));
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

  async function renderScreen(search: string, fetchFunction: FetchFunction): Promise<void> {
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
      expect(meta?.textContent).toBe('Költség (SDK becslés): $0.2131');
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

    it('leszereléskor leiratkozik a keretekről', async () => {
      await renderScreen('?runId=r-3', createFetchFunction());
      // Három feliratkozó: a transcript, a csomópontok élő állapota és a
      // futás lezárásának felismerése (T-009-25, T-009-25a).
      expect(frameListeners.size).toBe(3);
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
});
