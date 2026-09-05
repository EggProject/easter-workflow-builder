/* eslint-disable unicorn/no-null -- a szintetikus WorkflowGraphDocument/WorkflowNodeInput fixture-ök nullázható mezői a dróton ténylegesen `null` értéket hordoznak */
import type { FetchFunction } from '@easter-workflow-builder/core';
import { ReplaceGraphRequestSchema, type WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GraphEditorCanvasProperties } from './GraphEditorCanvas.tsx';
import { GraphEditorScreen } from './GraphEditorScreen.tsx';

/**
 * A `GraphEditorCanvas` mockolva: ez a spec a `GraphEditorScreen` SAJÁT
 * felelősségét teszteli (betöltés, mentés, piszkos állapot, mentés előtti
 * validáció), a vászon belső React Flow vezérlését a `GraphEditorCanvas.
 * spec.tsx` már lefedi. A mock az `onGraphChange` és a props többi mezőjét
 * rögzíti, hogy a teszt a valódi callback-et hívhassa meg közvetlenül, DOM
 * esemény szimuláció (és `@xyflow/react` mockolás) nélkül.
 */
const { capturedCanvasProperties } = vi.hoisted(() => {
  const capturedCanvasProperties: GraphEditorCanvasProperties[] = [];
  return { capturedCanvasProperties };
});

vi.mock('./GraphEditorCanvas.tsx', () => ({
  GraphEditorCanvas: (properties: GraphEditorCanvasProperties) => {
    capturedCanvasProperties.push(properties);
    return null;
  },
}));

function lastCanvasProperties(): GraphEditorCanvasProperties {
  const properties = capturedCanvasProperties.at(-1);
  if (properties === undefined) {
    throw new Error('a teszt nem talált rögzített <GraphEditorCanvas> propot');
  }
  return properties;
}

const API_ORIGIN = 'https://api.example.test';

const START_NODE: WorkflowNodeInput = {
  id: 'n-1',
  type: 'start',
  label: 'Indítás',
  positionX: 0,
  positionY: 0,
  config: { type: 'start', inputFields: [], onUnhandledError: null },
};

// A `WorkflowEdgeInput` alakú él - ez az, amit a valódi `GraphEditorCanvas.
// onGraphChange` is termelne (nincs `createdAtMs` mezője).
const EDGE_INPUT = {
  id: 'e-1',
  sourceNodeId: 'n-1',
  targetNodeId: 'n-1',
  sourceHandle: null,
  targetHandle: null,
  branchKey: null,
};

const GRAPH_DOCUMENT = {
  nodes: [{ ...START_NODE, createdAtMs: 0, updatedAtMs: 0 }],
  // Legalább egy él kell a betöltött dokumentumban is (nem csak a mentés
  // válaszában), különben a hidratáló hatás `edges.map(...)` hívása (a
  // `workflowEdgeToEdgeInput` vetítéssel) sosem futna le.
  edges: [{ ...EDGE_INPUT, createdAtMs: 0 }],
};

function jsonResponse(body: unknown): Response {
  return Response.json(body);
}

interface RouteCallLog {
  putBodies: string[];
  getCallCount: number;
}

/**
 * A `PUT` mock "szerver" a ténylegesen elküldött törzset adja vissza, timestamp
 * mezőkkel kiegészítve - enélkül a mentés utáni `baseline` a régi, be NEM
 * küldött adatra állna, és a mentetlen jelző a mentés UTÁN is fennmaradna.
 */
function echoAsGraphDocument(rawBody: string): unknown {
  const parsed = ReplaceGraphRequestSchema.safeParse(JSON.parse(rawBody));
  if (!parsed.success) {
    throw new Error('a teszt PUT törzse nem érvényes ReplaceGraphRequest alakú');
  }
  return {
    nodes: parsed.data.nodes.map((node) => ({ ...node, createdAtMs: 0, updatedAtMs: 0 })),
    edges: parsed.data.edges.map((edge) => ({ ...edge, createdAtMs: 0 })),
  };
}

function createFetchFunction(log: RouteCallLog): FetchFunction {
  return (_input, init) => {
    if (init.method === 'PUT') {
      const rawBody = typeof init.body === 'string' ? init.body : '{}';
      log.putBodies.push(rawBody);
      return Promise.resolve(jsonResponse(echoAsGraphDocument(rawBody)));
    }
    log.getCallCount += 1;
    return Promise.resolve(jsonResponse(GRAPH_DOCUMENT));
  };
}

const unreachableFetchFunction: FetchFunction = () => Promise.reject(new Error('kapcsolat megszakadt'));

const failingPutFetchFunction: FetchFunction = (_input, init) => {
  if (init.method === 'PUT') {
    return Promise.resolve(new Response('nem sikerult', { status: 500 }));
  }
  return Promise.resolve(jsonResponse(GRAPH_DOCUMENT));
};

describe('GraphEditorScreen', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    capturedCanvasProperties.length = 0;
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
      root.render(<GraphEditorScreen apiOrigin={API_ORIGIN} fetchFunction={fetchFunction} search={search} />);
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it('a betöltés sikertelenségére hibaüzenetet mutat', async () => {
    await renderScreen('?workflowId=wf-1', unreachableFetchFunction);
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('A szerver nem érhető el.');
  });

  it('az onSelectNode prop meghívható, hatás nélkül - a node-inspector (T-009-18) leendő fogyasztója', async () => {
    const log: RouteCallLog = { putBodies: [], getCallCount: 0 };
    await renderScreen('?workflowId=wf-1', createFetchFunction(log));
    expect(() => {
      lastCanvasProperties().onSelectNode('n-1');
    }).not.toThrow();
  });

  it('workflowId hiányában hibaüzenetet mutat, és nem kér vászont', async () => {
    const log: RouteCallLog = { putBodies: [], getCallCount: 0 };
    await renderScreen('', createFetchFunction(log));
    expect(container.textContent).toContain('Nincs megadva');
    expect(capturedCanvasProperties).toHaveLength(0);
    expect(log.getCallCount).toBe(0);
  });

  it('betöltés után a vászont rendereli, mentetlen jelző nélkül', async () => {
    const log: RouteCallLog = { putBodies: [], getCallCount: 0 };
    await renderScreen('?workflowId=wf-1', createFetchFunction(log));
    expect(log.getCallCount).toBe(1);
    expect(capturedCanvasProperties).toHaveLength(1);
    expect(container.textContent).not.toContain('Mentetlen változtatások');
  });

  it('egy módosítás után mentetlen jelzőt mutat, majd visszavonás után eltűnik (AC13)', async () => {
    const log: RouteCallLog = { putBodies: [], getCallCount: 0 };
    await renderScreen('?workflowId=wf-1', createFetchFunction(log));
    act(() => {
      lastCanvasProperties().onGraphChange([{ ...START_NODE, positionX: 99 }], [EDGE_INPUT]);
    });
    expect(container.textContent).toContain('Mentetlen változtatások');

    act(() => {
      lastCanvasProperties().onGraphChange([START_NODE], [EDGE_INPUT]);
    });
    expect(container.textContent).not.toContain('Mentetlen változtatások');
  });

  it('hibás gráfra (NaN a maxIterations mezőn) a Mentés nem indít kérést, és megnevezi a hibás mezőt (AC12)', async () => {
    const log: RouteCallLog = { putBodies: [], getCallCount: 0 };
    await renderScreen('?workflowId=wf-1', createFetchFunction(log));

    const invalidLoopNode: WorkflowNodeInput = {
      id: 'n-2',
      type: 'loop',
      label: 'Ciklus',
      positionX: 0,
      positionY: 0,
      config: { type: 'loop', maxIterations: Number('nem szám'), continueExpression: 'i < 5', onUnhandledError: null },
    };
    act(() => {
      lastCanvasProperties().onGraphChange([START_NODE, invalidLoopNode], []);
    });

    const saveButton = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Mentés');
    if (saveButton === undefined) {
      throw new Error('a teszt nem talált "Mentés" gombot');
    }
    await act(async () => {
      saveButton.click();
      await Promise.resolve();
    });

    expect(log.putBodies).toHaveLength(0);
    expect(container.textContent).toContain('maxIterations');
  });

  it('érvényes mentés után a piszkos jelző eltűnik, és sikeres Toast jelenik meg (AC15)', async () => {
    const log: RouteCallLog = { putBodies: [], getCallCount: 0 };
    await renderScreen('?workflowId=wf-1', createFetchFunction(log));

    act(() => {
      lastCanvasProperties().onGraphChange([{ ...START_NODE, positionX: 99 }], []);
    });
    expect(container.textContent).toContain('Mentetlen változtatások');

    const saveButton = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Mentés');
    if (saveButton === undefined) {
      throw new Error('a teszt nem talált "Mentés" gombot');
    }
    await act(async () => {
      saveButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(log.putBodies).toHaveLength(1);
    expect(container.textContent).not.toContain('Mentetlen változtatások');
    expect(container.querySelector('.toast__title')?.textContent).toBe('Gráf mentve');
  });

  it('sikertelen mentésre hiba Toast jelenik meg, a piszkos jelző megmarad', async () => {
    await renderScreen('?workflowId=wf-1', failingPutFetchFunction);

    act(() => {
      lastCanvasProperties().onGraphChange([{ ...START_NODE, positionX: 99 }], []);
    });

    const saveButton = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Mentés');
    if (saveButton === undefined) {
      throw new Error('a teszt nem talált "Mentés" gombot');
    }
    await act(async () => {
      saveButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('.toast__title')?.textContent).toBe('A mentés sikertelen');
    expect(container.textContent).toContain('Mentetlen változtatások');
  });
});
