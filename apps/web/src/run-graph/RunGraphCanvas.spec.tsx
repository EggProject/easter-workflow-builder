/* eslint-disable unicorn/no-null -- a szintetikus WorkflowNodeInput/WorkflowEdgeInput fixture-ök nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import type { WorkflowEdgeInput, WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import type * as XyflowReactModule from '@xyflow/react';
import type { NodeChange, ReactFlow } from '@xyflow/react';
import type { ComponentProps } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GraphNodeCardData, GraphNodeCardFlowNode } from '../graph-node-card/graph-node-card-data.ts';
import { RunGraphCanvas } from './RunGraphCanvas.tsx';
import type { BranchDecision } from './branch-decision.ts';
import { BRANCH_HIGHLIGHT_MODE_STORAGE_KEY } from './branch-highlight-mode-storage.ts';
import { HIGHLIGHTED_BRANCH_EDGE_CLASS_NAME } from './build-run-graph-flow-edges.ts';

type ReactFlowProperties = ComponentProps<typeof ReactFlow>;

/**
 * Ugyanaz a mock minta, mint a `GraphEditorCanvas.spec.tsx`-ben: a
 * `<ReactFlow>`-nak ténylegesen átadott propok rögzítése, hogy a csak
 * olvashatóságot adó három prop (AC19) és az `onNodesChange` mérési ága
 * DOM esemény szimuláció nélkül ellenőrizhető legyen (happy-dom alatt a
 * React Flow mérése nem fut le, M-53).
 */
const { capturedProperties } = vi.hoisted(() => {
  const capturedProperties: ReactFlowProperties[] = [];
  return { capturedProperties };
});

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof XyflowReactModule>();
  return {
    ...actual,
    ReactFlow: function ReactFlowSpy(properties: ReactFlowProperties) {
      capturedProperties.push(properties);
      return <actual.ReactFlow {...properties} />;
    },
  };
});

function lastCapturedProperties(): ReactFlowProperties {
  const properties = capturedProperties.at(-1);
  if (properties === undefined) {
    throw new Error('a teszt nem talált rögzített <ReactFlow> propot');
  }
  return properties;
}

/**
 * A vászonnak átadott élek közül a kiemelés osztályát viselők azonosítói.
 */
function highlightedEdgeIds(): (string | undefined)[] {
  return (lastCapturedProperties().edges ?? [])
    .filter((edge) => edge.className === HIGHLIGHTED_BRANCH_EDGE_CLASS_NAME)
    .map((edge) => edge.id);
}

const START_NODE: WorkflowNodeInput = {
  id: 'n1',
  type: 'start',
  label: 'Indítás',
  positionX: 0,
  positionY: 0,
  config: { type: 'start', inputFields: [], onUnhandledError: null },
};

const EDGE: WorkflowEdgeInput = {
  id: 'e1',
  sourceNodeId: 'n1',
  targetNodeId: 'n1',
  sourceHandle: null,
  targetHandle: null,
  branchKey: null,
};

const NODES: readonly GraphNodeCardData[] = [{ workflowNode: START_NODE, status: 'running' }];

const NO_DECISIONS: ReadonlyMap<string, readonly BranchDecision[]> = new Map();

const BRANCH_NODE: WorkflowNodeInput = {
  id: 'n-branch',
  type: 'branch',
  label: 'Elágazás',
  positionX: 400,
  positionY: 0,
  config: {
    type: 'branch',
    expression: 'input.kind',
    branches: [
      { key: 'igen', label: 'Igen' },
      { key: 'nem', label: 'Nem' },
    ],
    defaultBranchKey: 'nem',
    onUnhandledError: null,
  },
};

const BRANCH_EDGES: readonly WorkflowEdgeInput[] = [
  { ...EDGE, id: 'e-in', sourceNodeId: 'n1', targetNodeId: 'n-branch' },
  { ...EDGE, id: 'e-yes', sourceNodeId: 'n-branch', targetNodeId: 'n1', sourceHandle: 'igen', branchKey: 'igen' },
  { ...EDGE, id: 'e-no', sourceNodeId: 'n-branch', targetNodeId: 'n1', sourceHandle: 'nem', branchKey: 'nem' },
];

const BRANCH_NODES: readonly GraphNodeCardData[] = [{ workflowNode: START_NODE }, { workflowNode: BRANCH_NODE }];

function decision(eventId: number, overrides: Partial<BranchDecision>): BranchDecision {
  return { eventId, stepRunId: `sr-${String(eventId)}`, branchKey: 'igen', usedDefault: false, ...overrides };
}

/**
 * Az elágazás kétszer futott: előbb az "igen" ágra lépett, utána az
 * alapértelmezettre (a `defaultBranchKey` a "nem"). A "csak a legutóbbi" mód a
 * "nem" élt emeli ki, a "minden bejárt" mód mindkettőt.
 */
const BRANCH_DECISIONS: ReadonlyMap<string, readonly BranchDecision[]> = new Map([
  ['n-branch', [decision(1, { branchKey: 'igen' }), decision(2, { branchKey: null, usedDefault: true })]],
]);

const TOGGLE_SELECTOR = 'button[aria-label="Minden bejárt ág kiemelése"]';

describe('RunGraphCanvas', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    capturedProperties.length = 0;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    globalThis.localStorage.clear();
  });

  function renderCanvas(nodes: readonly GraphNodeCardData[] = NODES): void {
    act(() => {
      root.render(<RunGraphCanvas nodes={nodes} edges={[EDGE]} branchDecisionsByNodeId={NO_DECISIONS} />);
    });
  }

  function renderBranchCanvas(): void {
    act(() => {
      root.render(
        <RunGraphCanvas nodes={BRANCH_NODES} edges={BRANCH_EDGES} branchDecisionsByNodeId={BRANCH_DECISIONS} />,
      );
    });
  }

  function toggleButton(): HTMLButtonElement {
    const button = container.querySelector<HTMLButtonElement>(TOGGLE_SELECTOR);
    if (button === null) {
      throw new Error('a teszt nem talált kapcsoló gombot');
    }
    return button;
  }

  it('a nodesDraggable prop hamis', () => {
    renderCanvas();
    expect(lastCapturedProperties().nodesDraggable).toBe(false);
  });

  it('a nodesConnectable prop hamis', () => {
    renderCanvas();
    expect(lastCapturedProperties().nodesConnectable).toBe(false);
  });

  it('az elementsSelectable prop hamis', () => {
    renderCanvas();
    expect(lastCapturedProperties().elementsSelectable).toBe(false);
  });

  it('a pillanatkép csomópontjaiból és éleiből épít, a kártya adatát továbbadva', () => {
    renderCanvas();
    const properties = lastCapturedProperties();
    expect(properties.nodes?.map((node) => node.id)).toEqual(['n1']);
    expect(properties.edges?.map((edge) => edge.id)).toEqual(['e1']);
    expect(container.textContent).toContain('fut');
  });

  it('a nodeTypes hivatkozás két render között azonos', () => {
    renderCanvas();
    renderCanvas([{ workflowNode: START_NODE }]);
    const [first, ...rest] = capturedProperties;
    const last = rest.at(-1);
    expect(last?.nodeTypes).toBe(first?.nodeTypes);
  });

  it('a dimensions változást beolvasztja a mért méret térképbe, más változás típust elhagy', () => {
    renderCanvas();
    const { onNodesChange } = lastCapturedProperties();
    if (onNodesChange === undefined) {
      throw new Error('a teszt nem talált onNodesChange callbacket');
    }

    const positionChange: NodeChange<GraphNodeCardFlowNode> = { id: 'n1', type: 'position', dragging: false };
    act(() => {
      onNodesChange([positionChange]);
    });
    expect(lastCapturedProperties().nodes?.[0]?.measured).toBeUndefined();

    const dimensionChange: NodeChange<GraphNodeCardFlowNode> = {
      id: 'n1',
      type: 'dimensions',
      dimensions: { width: 358, height: 106 },
    };
    act(() => {
      onNodesChange([dimensionChange]);
    });
    expect(lastCapturedProperties().nodes?.[0]?.measured).toEqual({ width: 358, height: 106 });
  });
  describe('az ág kiemelés kapcsolója', () => {
    it('branch csomópont nélküli pillanatképen nem renderelődik', () => {
      renderCanvas();
      expect(container.querySelector(TOGGLE_SELECTOR)).toBeNull();
      expect(container.querySelector('.react-flow__controls')).not.toBeNull();
    });

    it('branch csomópontot tartalmazó pillanatképen a vezérlő panel utolsó gombja', () => {
      renderBranchCanvas();
      const buttons = [...container.querySelectorAll(':scope .react-flow__controls > .react-flow__controls-button')];
      expect(buttons.length).toBeGreaterThan(1);
      expect(buttons.at(-1)).toBe(toggleButton());
    });

    it('tárolt mód nélkül az alapértelmezés áll: nincs lenyomva', () => {
      renderBranchCanvas();
      expect(toggleButton().getAttribute('aria-pressed')).toBe('false');
    });

    it('a tárolt "all" módot az első renderen viseli: le van nyomva', () => {
      globalThis.localStorage.setItem(BRANCH_HIGHLIGHT_MODE_STORAGE_KEY, 'all');
      renderBranchCanvas();
      expect(toggleButton().getAttribute('aria-pressed')).toBe('true');
      expect(highlightedEdgeIds()).toEqual(['e-yes', 'e-no']);
    });

    it('ismeretlen tárolt értékre az alapértelmezés áll', () => {
      globalThis.localStorage.setItem(BRANCH_HIGHLIGHT_MODE_STORAGE_KEY, 'mindegyik');
      renderBranchCanvas();
      expect(toggleButton().getAttribute('aria-pressed')).toBe('false');
    });

    it('a kattintás váltja a módot, és elmenti a tárolóba, oda-vissza', () => {
      renderBranchCanvas();

      act(() => {
        toggleButton().click();
      });
      expect(toggleButton().getAttribute('aria-pressed')).toBe('true');
      expect(globalThis.localStorage.getItem(BRANCH_HIGHLIGHT_MODE_STORAGE_KEY)).toBe('all');

      act(() => {
        toggleButton().click();
      });
      expect(toggleButton().getAttribute('aria-pressed')).toBe('false');
      expect(globalThis.localStorage.getItem(BRANCH_HIGHLIGHT_MODE_STORAGE_KEY)).toBe('latest');
    });
  });

  describe('a kiemelt élek', () => {
    it('az alapértelmezett "csak a legutóbbi" módban csak a legutóbbi döntés éle kap osztályt', () => {
      renderBranchCanvas();
      expect(highlightedEdgeIds()).toEqual(['e-no']);
    });

    it('a kapcsoló "minden bejárt ág" módban minden döntés éle osztályt kap, a bemenő él nem', () => {
      renderBranchCanvas();
      act(() => {
        toggleButton().click();
      });
      expect(highlightedEdgeIds()).toEqual(['e-yes', 'e-no']);
      act(() => {
        toggleButton().click();
      });
      expect(highlightedEdgeIds()).toEqual(['e-no']);
    });

    it('döntés nélkül egyik él sem kap osztályt', () => {
      act(() => {
        root.render(
          <RunGraphCanvas nodes={BRANCH_NODES} edges={BRANCH_EDGES} branchDecisionsByNodeId={NO_DECISIONS} />,
        );
      });
      expect(highlightedEdgeIds()).toEqual([]);
    });
  });

  describe('a régi, kulcs nélküli elágazás élek (O-27)', () => {
    const KEYLESS_BRANCH_EDGE: WorkflowEdgeInput = { ...EDGE, id: 'e-regi', sourceNodeId: 'n-branch' };

    it('a branch forrású, null kulcsú él nem jut a vászonra, a többi él igen', () => {
      act(() => {
        root.render(
          <RunGraphCanvas
            nodes={BRANCH_NODES}
            edges={[...BRANCH_EDGES, KEYLESS_BRANCH_EDGE]}
            branchDecisionsByNodeId={NO_DECISIONS}
          />,
        );
      });
      expect(lastCapturedProperties().edges?.map((edge) => edge.id)).toEqual(['e-in', 'e-yes', 'e-no']);
    });

    it('az alapértelmezett ágra lépő döntés mellett is csak a kulcsos él kap osztályt', () => {
      act(() => {
        root.render(
          <RunGraphCanvas
            nodes={BRANCH_NODES}
            edges={[...BRANCH_EDGES, KEYLESS_BRANCH_EDGE]}
            branchDecisionsByNodeId={BRANCH_DECISIONS}
          />,
        );
      });
      expect(highlightedEdgeIds()).toEqual(['e-no']);
    });
  });
});
