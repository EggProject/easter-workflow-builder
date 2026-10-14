/* eslint-disable unicorn/no-null -- a szintetikus WorkflowNodeInput/WorkflowEdgeInput fixture-ök nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import type { WorkflowEdgeInput, WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import type * as XyflowReactModule from '@xyflow/react';
import type { ReactFlow } from '@xyflow/react';
import type { ComponentProps } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NodeInspector } from '../node-inspector/NodeInspector.tsx';
import type { AddNodeContextMenuProperties } from './AddNodeContextMenu.tsx';
import { GraphEditorCanvas } from './GraphEditorCanvas.tsx';
import { workflowEdgeToFlowEdge } from './graph-editor-edge-mapping.ts';
import { workflowNodeToFlowNode } from './graph-editor-node-mapping.ts';
import type { GraphElementIdGenerator } from './graph-element-id-generator.ts';

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
type OnAddNode = AddNodeContextMenuProperties['onAddNode'];

function dispatchContextMenu(target: Element, clientX: number, clientY: number): MouseEvent {
  const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX, clientY });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

function findAddNodeMenu(): Element | null {
  return document.body.querySelector(':scope [role="menu"][aria-label="Hozzáadás"]');
}

// A valódi könyvtár billentyű útja, happy-dom alatt: a `useKeyPress` a
// `document` `keydown` eseményét figyeli, a törlendő elemek a kiválasztott
// (`selected`) csomópontok és élek. REGRESSZIÓ: a könyvtár az éleket és a
// csomópontokat két külön változáslistában jelzi, és a törölt csomópont élei
// a gráfban maradtak, mert a második hívás visszaírta az elsőét. A `target` az
// esemény célja (alapértelmezésben a `document`: nincs fókuszált elem).
async function pressKey(key: string, target: EventTarget = document): Promise<void> {
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, code: key, bubbles: true, cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent('keyup', { key, code: key, bubbles: true, cancelable: true }));
    await Promise.resolve();
  });
}

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
    graphElementIdGenerator: GraphElementIdGenerator = () => 'generated-edge-id',
    onAddNode: OnAddNode = vi.fn<OnAddNode>(),
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
          graphElementIdGenerator={graphElementIdGenerator}
          onAddNode={onAddNode}
        />,
      );
    });
  }

  // A beállítás panel és a vászon egy dokumentumban, ahogy a `GraphEditorScreen`
  // összerakja őket (a "törlés" csoport panel tesztjei használják).
  function renderCanvasWithInspector(onGraphChange: OnGraphChange): void {
    act(() => {
      root.render(
        <>
          <GraphEditorCanvas
            nodes={[START_NODE, FAN_OUT_NODE]}
            edges={[EDGE]}
            onGraphChange={onGraphChange}
            selectedNodeId="n2"
            onSelectNode={vi.fn()}
            autoLayoutRevision={0}
            graphElementIdGenerator={() => 'generated-edge-id'}
            onAddNode={vi.fn()}
          />
          <NodeInspector
            node={FAN_OUT_NODE}
            onChange={vi.fn()}
            onClose={vi.fn()}
            onDelete={vi.fn()}
            inheritedProviderDescription="nincs"
            isSaveAttempted={false}
          />
        </>,
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

  it('az onNodesChange az applyNodeChanges-en át a pozíció változást a domain állapotba írja (AC9)', () => {
    const onGraphChange = vi.fn<OnGraphChange>();
    renderCanvas([START_NODE, FAN_OUT_NODE], [EDGE], onGraphChange, vi.fn());
    act(() => {
      lastCapturedProperties().onNodesChange?.([
        { id: 'n2', type: 'position', position: { x: 5, y: 6 }, dragging: false },
      ]);
    });
    expect(onGraphChange).toHaveBeenLastCalledWith(
      [START_NODE, { ...FAN_OUT_NODE, positionX: 5, positionY: 6 }],
      [EDGE],
    );
  });

  // A törlés egyetlen útja az `onDelete` (lásd a lenti `onDelete` csoportot): a
  // `remove` változásból külön gráf állapot nem épülhet, mert a könyvtár az
  // élek és a csomópontok törlését két külön hívásban jelzi.
  it('az onNodesChange a remove változást NEM adja vissza a domain állapotba', () => {
    const onGraphChange = vi.fn<OnGraphChange>();
    renderCanvas([START_NODE, FAN_OUT_NODE], [EDGE], onGraphChange, vi.fn());
    act(() => {
      lastCapturedProperties().onNodesChange?.([{ id: 'n2', type: 'remove' }]);
    });
    expect(onGraphChange).not.toHaveBeenCalled();
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

  it('vegyes változás listánál a nem dimensions, nem remove ág a domain állapotba kerül', () => {
    const onGraphChange = vi.fn<OnGraphChange>();
    renderCanvas([START_NODE, FAN_OUT_NODE], [EDGE], onGraphChange, vi.fn());
    act(() => {
      lastCapturedProperties().onNodesChange?.([
        { id: 'n1', type: 'dimensions', dimensions: { width: 358, height: 106 } },
        { id: 'n2', type: 'remove' },
        { id: 'n1', type: 'position', position: { x: 7, y: 8 }, dragging: false },
      ]);
    });
    expect(onGraphChange).toHaveBeenCalledTimes(1);
    expect(onGraphChange).toHaveBeenLastCalledWith(
      [{ ...START_NODE, positionX: 7, positionY: 8 }, FAN_OUT_NODE],
      [EDGE],
    );
  });

  it('az onEdgesChange a remove változást NEM adja vissza a domain állapotba', () => {
    const onGraphChange = vi.fn<OnGraphChange>();
    renderCanvas([START_NODE, FAN_OUT_NODE], [EDGE], onGraphChange, vi.fn());
    act(() => {
      lastCapturedProperties().onEdgesChange?.([{ id: 'e1', type: 'remove' }]);
    });
    expect(onGraphChange).not.toHaveBeenCalled();
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

  it('vegyes él változás listánál a select a nézeti állapotba kerül, a remove nem hat a domain állapotra', () => {
    const onGraphChange = vi.fn<OnGraphChange>();
    renderCanvas([START_NODE, FAN_OUT_NODE], [EDGE, SECOND_EDGE], onGraphChange, vi.fn());
    act(() => {
      lastCapturedProperties().onEdgesChange?.([
        { id: 'e1', type: 'select', selected: true },
        { id: 'e2', type: 'remove' },
      ]);
    });
    expect(onGraphChange).not.toHaveBeenCalled();
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

  it('az új él azonosítója a GraphElementIdGenerator porton át jön, xy-edge__ előtagú azonosító nincs (M-101)', () => {
    const onGraphChange = vi.fn<OnGraphChange>();
    renderCanvas([START_NODE, FAN_OUT_NODE], [], onGraphChange, vi.fn(), undefined, 0, () => 'port-edge-id');
    act(() => {
      lastCapturedProperties().onConnect?.({ source: 'n1', target: 'n2', sourceHandle: null, targetHandle: null });
    });
    const [, lastEdges] = onGraphChange.mock.calls.at(-1) ?? [];
    expect(lastEdges?.map((edge) => edge.id)).toEqual(['port-edge-id']);
  });

  it('már létező kapcsolat újrakötése nem vesz fel új élt, és a meglévő él azonosítója megmarad', () => {
    const onGraphChange = vi.fn<OnGraphChange>();
    renderCanvas([START_NODE, FAN_OUT_NODE], [EDGE], onGraphChange, vi.fn(), undefined, 0, () => 'duplicate-edge-id');
    act(() => {
      lastCapturedProperties().onConnect?.({ source: 'n1', target: 'n2', sourceHandle: null, targetHandle: null });
    });
    const [, lastEdges] = onGraphChange.mock.calls.at(-1) ?? [];
    expect(lastEdges?.map((edge) => edge.id)).toEqual(['e1']);
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

  describe('jobb klikk menü (SPEC-008 5.8)', () => {
    it('a vászon üres területén jobb klikkre a böngésző menüje helyett a kilenc menüpontos "Hozzáadás" menü nyílik (AC75)', () => {
      renderCanvas([START_NODE, FAN_OUT_NODE], [EDGE], vi.fn(), vi.fn());
      const paneElement = container.querySelector('.react-flow__pane');
      if (paneElement === null) {
        throw new Error('a teszt nem talált .react-flow__pane elemet');
      }
      expect(findAddNodeMenu()).toBeNull();

      const event = dispatchContextMenu(paneElement, 120, 80);

      expect(event.defaultPrevented).toBe(true);
      const menu = findAddNodeMenu();
      expect([...(menu?.querySelectorAll('[role="menuitem"]') ?? [])].map((item) => item.textContent)).toEqual([
        'Agent lépés',
        'Elágazás',
        'Szétosztás',
        'Összefésülés',
        'Ciklus',
        'Emberi jóváhagyás',
        'Hibakezelő',
        'Al-workflow',
        'Szkript',
      ]);
    });

    it('csomóponton jobb klikkre nem nyílik menü, és a böngésző saját menüje sincs tiltva (AC75)', () => {
      renderCanvas([START_NODE, FAN_OUT_NODE], [EDGE], vi.fn(), vi.fn());
      const nodeElement = container.querySelector('[data-id="n1"]');
      if (nodeElement === null) {
        throw new Error('a teszt nem talált "n1" node elemet');
      }

      const event = dispatchContextMenu(nodeElement, 10, 10);

      expect(event.defaultPrevented).toBe(false);
      expect(findAddNodeMenu()).toBeNull();
    });

    it('menüpont választására a típust és a kattintás pontjából átváltott helyet adja tovább, majd bezárul (AC76)', () => {
      const onAddNode = vi.fn<OnAddNode>();
      const onGraphChange = vi.fn<OnGraphChange>();
      renderCanvas([START_NODE], [], onGraphChange, vi.fn(), undefined, 0, undefined, onAddNode);
      const paneElement = container.querySelector('.react-flow__pane');
      if (paneElement === null) {
        throw new Error('a teszt nem talált .react-flow__pane elemet');
      }
      dispatchContextMenu(paneElement, 120, 80);
      const loopItem = [...(findAddNodeMenu()?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])].find(
        (item) => item.textContent === 'Ciklus',
      );

      act(() => {
        loopItem?.click();
      });

      // happy-dom alatt a vászon doboza a (0, 0) pontban áll, és a nézet
      // eltolás nélküli, egyszeres nagyítású, tehát a valódi átváltás a
      // kattintás pontját adja; a nem azonos átváltást az
      // `AddNodeContextMenu.spec.tsx` befecskendezett átváltója igazolja.
      expect(onAddNode).toHaveBeenCalledTimes(1);
      expect(onAddNode).toHaveBeenCalledWith('loop', { x: 120, y: 80 });
      expect(findAddNodeMenu()).toBeNull();
      // A vászon maga nem vesz fel csomópontot: a felvétel a szülőé.
      expect(onGraphChange).not.toHaveBeenCalled();
    });
  });

  describe('törlés (SPEC-008 5.9)', () => {
    it('a deleteKeyCode pontosan a Backspace és a Delete (M-95, AC82)', () => {
      renderCanvas([START_NODE], [], vi.fn(), vi.fn());
      expect(lastCapturedProperties().deleteKeyCode).toEqual(['Backspace', 'Delete']);
    });

    it('a deleteKeyCode referenciája azonos marad két render között', () => {
      renderCanvas([START_NODE], [], vi.fn(), vi.fn());
      const firstKeyCode = lastCapturedProperties().deleteKeyCode;
      renderCanvas([START_NODE], [], vi.fn(), vi.fn(), 'n1');
      expect(lastCapturedProperties().deleteKeyCode).toBe(firstKeyCode);
    });

    it('az onDelete egyetlen onGraphChange hívásban törli a csomópontot és a rá kötött éleket', () => {
      const onGraphChange = vi.fn<OnGraphChange>();
      renderCanvas([START_NODE, FAN_OUT_NODE], [EDGE, SECOND_EDGE], onGraphChange, vi.fn());
      act(() => {
        lastCapturedProperties().onDelete?.({
          nodes: [workflowNodeToFlowNode(FAN_OUT_NODE)],
          edges: [workflowEdgeToFlowEdge(EDGE), workflowEdgeToFlowEdge(SECOND_EDGE)],
        });
      });
      expect(onGraphChange).toHaveBeenCalledTimes(1);
      expect(onGraphChange).toHaveBeenCalledWith([START_NODE], []);
    });

    it('az onDelete csak a törölt élt veszi ki, a csomópontok és a másik él megmarad', () => {
      const onGraphChange = vi.fn<OnGraphChange>();
      renderCanvas([START_NODE, FAN_OUT_NODE], [EDGE, SECOND_EDGE], onGraphChange, vi.fn());
      act(() => {
        lastCapturedProperties().onDelete?.({ nodes: [], edges: [workflowEdgeToFlowEdge(SECOND_EDGE)] });
      });
      expect(onGraphChange).toHaveBeenCalledTimes(1);
      expect(onGraphChange).toHaveBeenCalledWith([START_NODE, FAN_OUT_NODE], [EDGE]);
    });

    it.each(['Backspace', 'Delete'])(
      'a(z) %s billentyű a kiválasztott csomópontot a rá kötött élekkel együtt, egyetlen hívásban törli',
      async (key) => {
        const onGraphChange = vi.fn<OnGraphChange>();
        renderCanvas([START_NODE, FAN_OUT_NODE], [EDGE, SECOND_EDGE], onGraphChange, vi.fn(), 'n2');
        await pressKey(key);
        expect(onGraphChange).toHaveBeenCalledTimes(1);
        expect(onGraphChange).toHaveBeenCalledWith([START_NODE], []);
      },
    );

    it.each(['Backspace', 'Delete'])(
      'a(z) %s billentyű a Start csomópontot nem törli (deletable: false)',
      async (key) => {
        const onGraphChange = vi.fn<OnGraphChange>();
        renderCanvas([START_NODE, FAN_OUT_NODE], [EDGE], onGraphChange, vi.fn(), 'n1');
        await pressKey(key);
        expect(onGraphChange).not.toHaveBeenCalled();
      },
    );

    it('beviteli elemen lenyomott Backspace nem töröl csomópontot (a könyvtár beviteli elem szűrője)', async () => {
      const onGraphChange = vi.fn<OnGraphChange>();
      renderCanvas([START_NODE, FAN_OUT_NODE], [EDGE], onGraphChange, vi.fn(), 'n2');
      const input = document.createElement('input');
      document.body.append(input);
      await act(async () => {
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', code: 'Backspace', bubbles: true }));
        await Promise.resolve();
        await Promise.resolve();
      });
      input.remove();
      expect(onGraphChange).not.toHaveBeenCalled();
    });

    // A billentyűt a `document` figyeli, a panel `.nokey` osztálya pedig a
    // panel teljes területén kiszűri a törlést (user döntés 2026-10-14,
    // SPEC-008 5.9).
    describe('a beállítás panelen (user döntés 2026-10-14)', () => {
      it.each(['Backspace', 'Delete'])(
        'a panel minden gombján és választóján lenyomott %s nem töröl csomópontot',
        async (key) => {
          const onGraphChange = vi.fn<OnGraphChange>();
          renderCanvasWithInspector(onGraphChange);
          const panelControls = [...container.querySelectorAll<HTMLButtonElement>(':scope .node-inspector button')];
          // A Törlés gomb, a Bezárás gomb és legalább egy választó (combobox).
          expect(panelControls.length).toBeGreaterThanOrEqual(3);
          expect(panelControls.some((control) => control.getAttribute('role') === 'combobox')).toBe(true);
          for (const control of panelControls) {
            control.focus();
            await pressKey(key, control);
          }
          expect(onGraphChange).not.toHaveBeenCalled();
        },
      );

      it.each(['Backspace', 'Delete'])(
        'a panelen kívüli gombon lenyomott %s a kiválasztott csomópontot törli',
        async (key) => {
          const onGraphChange = vi.fn<OnGraphChange>();
          renderCanvasWithInspector(onGraphChange);
          const outsideButton = document.createElement('button');
          document.body.append(outsideButton);
          outsideButton.focus();
          await pressKey(key, outsideButton);
          outsideButton.remove();
          expect(onGraphChange).toHaveBeenCalledTimes(1);
          expect(onGraphChange).toHaveBeenCalledWith([START_NODE], []);
        },
      );
    });
  });
});
