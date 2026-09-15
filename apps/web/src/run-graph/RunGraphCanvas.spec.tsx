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
  });

  function renderCanvas(nodes: readonly GraphNodeCardData[] = NODES): void {
    act(() => {
      root.render(<RunGraphCanvas nodes={nodes} edges={[EDGE]} />);
    });
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
});
