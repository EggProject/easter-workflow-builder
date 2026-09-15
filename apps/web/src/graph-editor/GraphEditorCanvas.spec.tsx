/* eslint-disable unicorn/no-null -- a szintetikus WorkflowNodeInput/WorkflowEdgeInput fixture-ök nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import type { WorkflowEdgeInput, WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import type * as XyflowReactModule from '@xyflow/react';
import type { ReactFlow } from '@xyflow/react';
import type { ComponentProps } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GraphEditorCanvas } from './GraphEditorCanvas.tsx';

/**
 * A `<ReactFlow>` tényleges propjainak típusa - a mock modul alatt is a
 * valódi típusdeklarációt látjuk, mert ez `import type`, amit a `vi.mock`
 * futásidejű helyettesítése nem érint.
 */
type ReactFlowProperties = ComponentProps<typeof ReactFlow>;

/**
 * A `vi.hoisted` a `vi.mock` fölé emeli ezt a blokkot (Vitest dokumentált
 * mintája), hogy a mock factory elérje. Minden renderen a ténylegesen a
 * `<ReactFlow>`-nak átadott propokat rögzíti, hogy a `nodeTypes` referencia
 * azonosságát (M-56, AC8) és a `onNodesChange`/`onEdgesChange`/`onConnect`/
 * `isValidConnection` callback-eket (AC9, AC10, AC11) közvetlenül,
 * DOM esemény szimuláció nélkül lehessen ellenőrizni - ez utóbbiak
 * kiváltásához valódi felhasználói interakció (drag, connect) happy-dom
 * alatt nem érhető el (M-53 general elve: mért geometriától függő
 * viselkedés nem tesztelhető happy-dom alatt, csak e2e-vel, ami F7,
 * jelen lépés hatókörén kívül esik - saját méréssel megerősítve: sem
 * `click`, sem `pointerdown`+`pointerup` szintetikus esemény nem váltja ki
 * a React Flow belső drag-alapú kiválasztását happy-dom alatt).
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

const FAN_OUT_NODE: WorkflowNodeInput = {
  id: 'n2',
  type: 'fan_out',
  label: 'Szétosztás',
  positionX: 200,
  positionY: 0,
  config: { type: 'fan_out', itemsExpression: 'items', branchLabelTemplate: '{{item}}', onUnhandledError: null },
};

const EDGE: WorkflowEdgeInput = {
  id: 'e1',
  sourceNodeId: 'n1',
  targetNodeId: 'n2',
  sourceHandle: null,
  targetHandle: null,
  branchKey: null,
};

const SECOND_EDGE: WorkflowEdgeInput = {
  id: 'e2',
  sourceNodeId: 'n2',
  targetNodeId: 'n1',
  sourceHandle: null,
  targetHandle: null,
  branchKey: null,
};

type OnGraphChange = (nodes: readonly WorkflowNodeInput[], edges: readonly WorkflowEdgeInput[]) => void;
type OnSelectNode = (nodeId: string | undefined) => void;

describe('GraphEditorCanvas', () => {
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

  function renderCanvas(
    nodes: readonly WorkflowNodeInput[],
    edges: readonly WorkflowEdgeInput[],
    onGraphChange: OnGraphChange,
    onSelectNode: OnSelectNode,
    selectedNodeId?: string,
    autoLayoutRevision = 0,
  ): void {
    act(() => {
      root.render(
        <GraphEditorCanvas
          nodes={nodes}
          edges={edges}
          onGraphChange={onGraphChange}
          selectedNodeId={selectedNodeId}
          onSelectNode={onSelectNode}
          autoLayoutRevision={autoLayoutRevision}
        />,
      );
    });
  }

  it('a kapott node-okat és éleket megjeleníti, onGraphChange hívás nélkül (vezérelt komponens)', () => {
    const onGraphChange = vi.fn<OnGraphChange>();
    renderCanvas([START_NODE, FAN_OUT_NODE], [EDGE], onGraphChange, vi.fn());
    expect(onGraphChange).not.toHaveBeenCalled();
    expect(container.querySelector('[data-id="n1"]')).not.toBeNull();
    expect(container.querySelector('[data-id="n2"]')).not.toBeNull();
  });

  it('a nodes prop külső (pl. node-inspector általi) módosítására a vászon a felmountolt állapotban is frissül', () => {
    // A `START_NODE.label` szándékosan eltér a `GRAPH_NODE_CATALOG` `start`
    // bejegyzésének saját, mindig kirajzolt "Indítás" típuscímkéjétől
    // (`GraphNodeCard.tsx` `graph-node-card__type`), különben az átnevezés
    // előtti/utáni szöveg nem volna megkülönböztethető a típuscímkétől.
    const originalLabelStartNode: WorkflowNodeInput = { ...START_NODE, label: 'Kezdőpont' };
    const onGraphChange = vi.fn<OnGraphChange>();
    renderCanvas([originalLabelStartNode], [], onGraphChange, vi.fn());
    expect(container.textContent).toContain('Kezdőpont');

    const renamedStartNode: WorkflowNodeInput = { ...originalLabelStartNode, label: 'Átnevezve' };
    renderCanvas([renamedStartNode], [], onGraphChange, vi.fn());
    expect(container.textContent).toContain('Átnevezve');
    expect(container.textContent).not.toContain('Kezdőpont');
  });

  it('a nodeTypes referenciája azonos marad két render között (M-56, AC8)', () => {
    const onGraphChange = vi.fn<OnGraphChange>();
    renderCanvas([START_NODE], [], onGraphChange, vi.fn());
    const firstNodeTypes = lastCapturedProperties().nodeTypes;
    renderCanvas([START_NODE], [], onGraphChange, vi.fn(), 'n1');
    const secondNodeTypes = lastCapturedProperties().nodeTypes;
    expect(secondNodeTypes).toBe(firstNodeTypes);
  });

  it('node kattintásra az onSelectNode a kattintott node azonosítóját kapja', () => {
    const onSelectNode = vi.fn<OnSelectNode>();
    renderCanvas([START_NODE, FAN_OUT_NODE], [], vi.fn(), onSelectNode);
    const nodeElement = container.querySelector('[data-id="n1"]');
    if (nodeElement === null) {
      throw new Error('a teszt nem talált "n1" node elemet');
    }
    act(() => {
      nodeElement.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(onSelectNode).toHaveBeenCalledWith('n1');
  });

  it('a vászon (pane) kattintásra az onSelectNode undefined-et kap', () => {
    const onSelectNode = vi.fn<OnSelectNode>();
    renderCanvas([START_NODE], [], vi.fn(), onSelectNode);
    const paneElement = container.querySelector('.react-flow__pane');
    if (paneElement === null) {
      throw new Error('a teszt nem talált .react-flow__pane elemet');
    }
    act(() => {
      paneElement.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(onSelectNode).toHaveBeenCalledWith(undefined);
  });

  it('a selectedNodeId prop a megfelelő node-ot vizuálisan kiválasztottá teszi', () => {
    const onGraphChange = vi.fn<OnGraphChange>();
    renderCanvas([START_NODE, FAN_OUT_NODE], [], onGraphChange, vi.fn());
    const nodeElement = container.querySelector('[data-id="n1"]');
    if (nodeElement === null) {
      throw new Error('a teszt nem talált "n1" node elemet');
    }
    expect(nodeElement.className).not.toContain('selected');
    renderCanvas([START_NODE, FAN_OUT_NODE], [], onGraphChange, vi.fn(), 'n1');
    expect(nodeElement.className).toContain('selected');
  });

  it('az onNodesChange az applyNodeChanges-en át törli a node-ot az állapotból (AC9)', () => {
    const onGraphChange = vi.fn<OnGraphChange>();
    renderCanvas([START_NODE, FAN_OUT_NODE], [EDGE], onGraphChange, vi.fn());
    act(() => {
      lastCapturedProperties().onNodesChange?.([{ id: 'n2', type: 'remove' }]);
    });
    expect(onGraphChange).toHaveBeenLastCalledWith([START_NODE], [EDGE]);
  });

  // REGRESSZIÓ (2026-09-05): a `dimensions` változás mérési eredmény, nem gráf
  // szerkesztés. Ha a domain állapotba menne vissza, a `measured` mező a
  // `WorkflowNodeInput` leképezésen elveszne, a React Flow `adoptUserNodes`
  // pedig minden körben újramérésre kényszerülne - a csomópont tartósan
  // `visibility: hidden` maradna, él nem rajzolódna, és a `ResizeObserver`
  // hurok sosem konvergálna (lásd `measured-node-sizes.ts`).
  it('az onNodesChange a dimensions változást NEM adja vissza a domain állapotba', () => {
    const onGraphChange = vi.fn<OnGraphChange>();
    renderCanvas([START_NODE, FAN_OUT_NODE], [EDGE], onGraphChange, vi.fn());
    act(() => {
      lastCapturedProperties().onNodesChange?.([
        { id: 'n1', type: 'dimensions', dimensions: { width: 358, height: 106 } },
      ]);
    });
    expect(onGraphChange).not.toHaveBeenCalled();
  });

  it('az onNodesChange a mért méretet a <ReactFlow> nodes propjára írja vissza', () => {
    renderCanvas([START_NODE, FAN_OUT_NODE], [EDGE], vi.fn(), vi.fn());
    act(() => {
      lastCapturedProperties().onNodesChange?.([
        { id: 'n1', type: 'dimensions', dimensions: { width: 358, height: 106 } },
      ]);
    });
    const measuredNode = lastCapturedProperties().nodes?.find((node) => node.id === 'n1');
    expect(measuredNode?.measured).toEqual({ width: 358, height: 106 });
    const unmeasuredNode = lastCapturedProperties().nodes?.find((node) => node.id === 'n2');
    expect(unmeasuredNode?.measured).toBeUndefined();
  });

  it('vegyes változás listánál a nem dimensions ág a domain állapotba kerül', () => {
    const onGraphChange = vi.fn<OnGraphChange>();
    renderCanvas([START_NODE, FAN_OUT_NODE], [EDGE], onGraphChange, vi.fn());
    act(() => {
      lastCapturedProperties().onNodesChange?.([
        { id: 'n1', type: 'dimensions', dimensions: { width: 358, height: 106 } },
        { id: 'n2', type: 'remove' },
      ]);
    });
    expect(onGraphChange).toHaveBeenLastCalledWith([START_NODE], [EDGE]);
  });

  it('az onEdgesChange az applyEdgeChanges-en át törli az élt az állapotból (AC9)', () => {
    const onGraphChange = vi.fn<OnGraphChange>();
    renderCanvas([START_NODE, FAN_OUT_NODE], [EDGE], onGraphChange, vi.fn());
    act(() => {
      lastCapturedProperties().onEdgesChange?.([{ id: 'e1', type: 'remove' }]);
    });
    expect(onGraphChange).toHaveBeenLastCalledWith([START_NODE, FAN_OUT_NODE], []);
  });

  it('az onEdgesChange egy megmaradó élt a flowEdgeToWorkflowEdge-en át ad vissza (AC9)', () => {
    const onGraphChange = vi.fn<OnGraphChange>();
    renderCanvas([START_NODE, FAN_OUT_NODE], [EDGE, SECOND_EDGE], onGraphChange, vi.fn());
    act(() => {
      lastCapturedProperties().onEdgesChange?.([{ id: 'e2', type: 'remove' }]);
    });
    expect(onGraphChange).toHaveBeenLastCalledWith([START_NODE, FAN_OUT_NODE], [EDGE]);
  });

  // REGRESSZIÓ (2026-09-06): az él kiválasztása NÉZETI állapot. Ha a domain
  // állapotba menne vissza, a `selected` mező a `WorkflowEdgeInput`
  // leképezésen elveszne, az él sosem kapna `selected` osztályt, és a
  // `deleteKeyCode` alapértelmezése (Backspace) sem tudna mit törölni
  // (lásd `graph-selection.ts`).
  it('az onEdgesChange a select változást NEM adja vissza a domain állapotba', () => {
    const onGraphChange = vi.fn<OnGraphChange>();
    renderCanvas([START_NODE, FAN_OUT_NODE], [EDGE], onGraphChange, vi.fn());
    act(() => {
      lastCapturedProperties().onEdgesChange?.([{ id: 'e1', type: 'select', selected: true }]);
    });
    expect(onGraphChange).not.toHaveBeenCalled();
  });

  it('az onEdgesChange a kiválasztást a <ReactFlow> edges propjára írja vissza', () => {
    renderCanvas([START_NODE, FAN_OUT_NODE], [EDGE, SECOND_EDGE], vi.fn(), vi.fn());
    act(() => {
      lastCapturedProperties().onEdgesChange?.([{ id: 'e1', type: 'select', selected: true }]);
    });
    expect(lastCapturedProperties().edges?.find((edge) => edge.id === 'e1')?.selected).toBe(true);
    expect(lastCapturedProperties().edges?.find((edge) => edge.id === 'e2')?.selected).toBe(false);

    act(() => {
      lastCapturedProperties().onEdgesChange?.([{ id: 'e1', type: 'select', selected: false }]);
    });
    expect(lastCapturedProperties().edges?.find((edge) => edge.id === 'e1')?.selected).toBe(false);
  });

  it('vegyes él változás listánál a select a nézeti, a remove a domain állapotba kerül', () => {
    const onGraphChange = vi.fn<OnGraphChange>();
    renderCanvas([START_NODE, FAN_OUT_NODE], [EDGE, SECOND_EDGE], onGraphChange, vi.fn());
    act(() => {
      lastCapturedProperties().onEdgesChange?.([
        { id: 'e1', type: 'select', selected: true },
        { id: 'e2', type: 'remove' },
      ]);
    });
    expect(onGraphChange).toHaveBeenLastCalledWith([START_NODE, FAN_OUT_NODE], [EDGE]);
    expect(lastCapturedProperties().edges?.find((edge) => edge.id === 'e1')?.selected).toBe(true);
  });

  // REGRESSZIÓ (2026-09-06): élre kattintva a React Flow `select: false`
  // változást küld minden kiválasztott csomópontra (`addSelectedEdges`). Ha
  // ezt elnyeljük, a csomópont kiválasztva marad, és a Backspace a
  // kiválasztott élen kívül a csomópontot is törli.
  it('a csomópont kiválasztás megszűnését jelző select változás az onSelectNode-ra jut', () => {
    const onSelectNode = vi.fn<OnSelectNode>();
    renderCanvas([START_NODE, FAN_OUT_NODE], [EDGE], vi.fn(), onSelectNode, 'n1');
    act(() => {
      lastCapturedProperties().onNodesChange?.([{ id: 'n1', type: 'select', selected: false }]);
    });
    expect(onSelectNode).toHaveBeenCalledWith(undefined);
  });

  it('a csomópont select változása NEM kerül a domain állapotba', () => {
    const onGraphChange = vi.fn<OnGraphChange>();
    renderCanvas([START_NODE, FAN_OUT_NODE], [EDGE], onGraphChange, vi.fn(), 'n1');
    act(() => {
      lastCapturedProperties().onNodesChange?.([{ id: 'n2', type: 'select', selected: true }]);
    });
    expect(onGraphChange).not.toHaveBeenCalled();
  });

  it('az onConnect az addEdge-en át felveszi az új élt, a branchKey a sourceHandle-ből származik (AC10)', () => {
    const onGraphChange = vi.fn<OnGraphChange>();
    renderCanvas([START_NODE, FAN_OUT_NODE], [], onGraphChange, vi.fn());
    act(() => {
      lastCapturedProperties().onConnect?.({ source: 'n1', target: 'n2', sourceHandle: null, targetHandle: null });
    });
    const lastCall = onGraphChange.mock.calls.at(-1);
    if (lastCall === undefined) {
      throw new Error('a teszt nem talált onGraphChange hívást');
    }
    const [, lastEdges] = lastCall;
    expect(lastEdges).toHaveLength(1);
    expect(lastEdges[0]).toMatchObject({ sourceNodeId: 'n1', targetNodeId: 'n2', branchKey: null });
  });

  it('az isValidConnection elutasítja a bemenő handle nélküli start node-ra kötést (AC11)', () => {
    renderCanvas([START_NODE, FAN_OUT_NODE], [], vi.fn(), vi.fn());
    const isValid = lastCapturedProperties().isValidConnection?.({
      source: 'n2',
      target: 'n1',
      sourceHandle: null,
      targetHandle: null,
    });
    expect(isValid).toBe(false);
  });

  it('az isValidConnection engedélyezi a bemenő handle-lel rendelkező node-ra kötést (AC11)', () => {
    renderCanvas([START_NODE, FAN_OUT_NODE], [], vi.fn(), vi.fn());
    const isValid = lastCapturedProperties().isValidConnection?.({
      source: 'n1',
      target: 'n2',
      sourceHandle: null,
      targetHandle: null,
    });
    expect(isValid).toBe(true);
  });
});
