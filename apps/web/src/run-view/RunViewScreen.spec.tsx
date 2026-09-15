/* eslint-disable unicorn/no-null -- a szintetikus drótszintű fixture-ök nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import type { FetchFunction } from '@easter-workflow-builder/core';
import type { StreamFrame } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RunGraphCanvasProperties } from '../run-graph/RunGraphCanvas.tsx';
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
}

function createFetchFunction(overrides: FetchOverrides = {}): FetchFunction {
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
      return Promise.resolve(Response.json(overrides.stepRuns ?? [BASE_STEP_RUN]));
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

describe('RunViewScreen', () => {
  let container: HTMLDivElement;
  let root: Root;
  const navigate = vi.fn();

  beforeEach(() => {
    capturedCanvasProperties.length = 0;
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

  async function renderScreen(search: string, fetchFunction: FetchFunction, lastFrame?: StreamFrame): Promise<void> {
    await act(async () => {
      root.render(
        <RunViewScreen
          apiOrigin={API_ORIGIN}
          fetchFunction={fetchFunction}
          search={search}
          navigate={navigate}
          streamId={STREAM_ID}
          lastFrame={lastFrame}
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
          lastFrame={undefined}
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
    expect(container.querySelector('.run-view-screen__transcript-note')?.textContent).toContain('futás eseményei');
    expect(container.querySelector('[role="separator"]')?.getAttribute('aria-orientation')).toBe('vertical');
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
    const fetchFunction = createFetchFunction({ runDetailUrls });
    await renderScreen('?runId=r-3', fetchFunction);
    expect(runDetailUrls).toHaveLength(1);

    await renderScreen('?runId=r-3', fetchFunction, runFinishedFrame('r-3'));

    expect(runDetailUrls).toHaveLength(2);
  });

  it('másik futás run_finished keretére nem tölt újra', async () => {
    const runDetailUrls: string[] = [];
    const fetchFunction = createFetchFunction({ runDetailUrls });
    await renderScreen('?runId=r-3', fetchFunction);

    await renderScreen('?runId=r-3', fetchFunction, runFinishedFrame('r-99'));

    expect(runDetailUrls).toHaveLength(1);
  });

  it('az újratöltés alatt a rajz a helyén marad, csontváz nélkül', async () => {
    const runDetailUrls: string[] = [];
    const fetchFunction = createFetchFunction({ runDetailUrls });
    await renderScreen('?runId=r-3', fetchFunction);

    // A keret megérkezése a futás rekordjának újratöltését indítja: a
    // kérés `pending`, de a KORÁBBI rekord a helyén marad, tehát a rajz nem
    // villog.
    act(() => {
      root.render(
        <RunViewScreen
          apiOrigin={API_ORIGIN}
          fetchFunction={fetchFunction}
          search="?runId=r-3"
          navigate={navigate}
          streamId={STREAM_ID}
          lastFrame={runFinishedFrame('r-3')}
          streamReplayLimit={STREAM_REPLAY_LIMIT}
        />,
      );
    });

    expect(container.querySelector('.run-view-screen__loading')).toBeNull();
    expect(container.querySelector('.run-view-screen__header')).not.toBeNull();
  });
});
