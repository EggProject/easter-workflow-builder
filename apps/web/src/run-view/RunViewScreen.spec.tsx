/* eslint-disable unicorn/no-null -- a szintetikus drótszintű fixture-ök nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import type { FetchFunction } from '@easter-workflow-builder/core';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RunGraphCanvasProperties } from '../run-graph/RunGraphCanvas.tsx';
import { RunViewScreen } from './RunViewScreen.tsx';

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

interface FetchOverrides {
  readonly runDetail?: unknown;
  readonly snapshot?: unknown;
  readonly stepRuns?: unknown;
}

function createFetchFunction(overrides: FetchOverrides = {}): FetchFunction {
  return (input) => {
    const { pathname } = new URL(input);
    if (pathname.endsWith('/snapshot')) {
      return Promise.resolve(Response.json(overrides.snapshot ?? SNAPSHOT));
    }
    if (pathname.endsWith('/steps')) {
      return Promise.resolve(Response.json(overrides.stepRuns ?? [BASE_STEP_RUN]));
    }
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

describe('RunViewScreen', () => {
  let container: HTMLDivElement;
  let root: Root;
  const navigate = vi.fn();

  beforeEach(() => {
    capturedCanvasProperties.length = 0;
    navigate.mockClear();
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
        <RunViewScreen apiOrigin={API_ORIGIN} fetchFunction={fetchFunction} search={search} navigate={navigate} />,
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
});
