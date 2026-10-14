import type { WorkflowEdgeInput, WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import type { ContextMenuPosition } from '@easter-workflow-builder/ui';
import {
  addEdge,
  applyNodeChanges,
  Background,
  Controls,
  ReactFlow,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type EdgeSelectionChange,
  type NodeChange,
  type NodeDimensionChange,
  type NodeSelectionChange,
} from '@xyflow/react';
import { useCallback, useMemo, useState, type MouseEvent as ReactMouseEvent, type ReactElement } from 'react';
import { GraphNodeCard } from '../graph-node-card/GraphNodeCard.tsx';
import { GraphNodeCardSizeStyle } from '../graph-node-card/GraphNodeCardSizeStyle.tsx';
import type { GraphNodeCardFlowNode } from '../graph-node-card/graph-node-card-data.ts';
import { AddNodeContextMenu, type AddNodeContextMenuProperties } from './AddNodeContextMenu.tsx';
import { FitViewOnAutoLayout } from './FitViewOnAutoLayout.tsx';
import { flowEdgeToWorkflowEdge, workflowEdgeToFlowEdge } from './graph-editor-edge-mapping.ts';
import { flowNodeToWorkflowNode, workflowNodeToFlowNode } from './graph-editor-node-mapping.ts';
import type { GraphEditSession } from './graph-edit-history.ts';
import type { GraphElementIdGenerator } from './graph-element-id-generator.ts';
import { isNodeDeselected, mergeEdgeSelection, type SelectedEdgeIds } from './graph-selection.ts';
import { isValidGraphConnection } from './is-valid-connection.ts';
import { mergeMeasuredNodeSizes, withMeasuredNodeSize, type MeasuredNodeSizes } from './measured-node-sizes.ts';
import '@xyflow/react/dist/style.css';
import './graph-canvas-theme.css';
import './graph-editor.css';

/**
 * A vászon egyetlen node típusa, modul szintű `const` (M-56): a
 * `GraphEditorCanvas` sosem hozza létre újra render közben, tehát a
 * hivatkozás két render között azonos marad, és a React Flow nem építi
 * újra a teljes vásznat minden szülő rendernél (AC8).
 */
const NODE_TYPES = { workflowNode: GraphNodeCard };

/**
 * A törlés billentyűi (SPEC-008 5.9, M-95). Modul szintű `const`, mert a
 * React Flow `useKeyPress` hookja a `keyCode` hivatkozásra memoizál és
 * iratkozik fel: egy minden renderen új tömb a figyelőt minden renderen
 * újrakötné.
 */
const DELETE_KEY_CODE: string[] = ['Backspace', 'Delete'];

/**
 * A csomópont mozgatás menetének kulcsa a visszavonás történetében (SPEC-008
 * 5.10): egy húzás a végéig egy lépés.
 */
const NODE_DRAG_SESSION_KEY = 'node-drag';

export interface GraphEditorCanvasProperties {
  /**
   * A gráf teljes állapota, a szülő (`graph-editor-screen`, T-009-17) tartja
   * karban - a vászon teljesen vezérelt (React Flow "Controlled Flow"
   * mintája): sem belső `nodes`/`edges` állapotot, sem "csak induláskor"
   * feldolgozott propot nem tart. Ez azért szükséges, mert a node beállítás
   * panel (`node-inspector`, T-009-18) is EZT az állapotot módosítja (a
   * `config` mezőn át), és a módosításnak a már felmountolt vásznon is meg
   * kell jelennie - amit egy "csak induláskor olvasott" prop nem tenne meg.
   */
  readonly nodes: readonly WorkflowNodeInput[];
  readonly edges: readonly WorkflowEdgeInput[];
  /**
   * Minden node/él változás után hívódik, a domain alakra visszaalakítva
   * (SPEC-008 5.5: a mentetlen jelző és a mentés ebből az állapotból épül,
   * a `graph-editor-screen` témában, T-009-17). A csomópont mozgatása a
   * húzás menetét is megadja (`session`), hogy a visszavonás története a
   * húzást a végéig egy lépésnek vegye (SPEC-008 5.10, M-117); a többi
   * változás (él létrehozás, törlés) menet nélkül, önálló lépés.
   */
  readonly onGraphChange: (
    nodes: readonly WorkflowNodeInput[],
    edges: readonly WorkflowEdgeInput[],
    session?: GraphEditSession,
  ) => void;
  /**
   * A kiválasztott csomópont azonosítója - a beállítás panel (`node-inspector`,
   * T-009-18) ez alapján dönti el, mit szerkeszt. A vászon ezt vizuálisan is
   * kiemeli (`Node.selected`).
   */
  readonly selectedNodeId: string | undefined;
  readonly onSelectNode: (nodeId: string | undefined) => void;
  /**
   * Az automatikus elrendezések számlálója (`graph-editor-screen`): minden
   * "Elrendezés" kattintás növeli eggyel. A vászon ennek a MEGVÁLTOZÁSÁRA
   * illeszti újra a nézetet, mert a `fitView` prop dokumentált jelentése
   * kizárólag a kezdeti nézetre szól ("the flow will be zoomed and panned to
   * fit all the nodes INITIALLY provided") - egy későbbi, teljes pozíció
   * átírás után a nézet a régi nagyításon és eltolásán maradna, tehát az új
   * elrendezés a vászon egy tetszőleges sarkába csúszna, nagy üres területet
   * hagyva maga körül (2026-09-06-i saját mérés: a `fitView` prop szerinti
   * kezdeti nagyítás a kattintás után változatlan maradt).
   */
  readonly autoLayoutRevision: number;
  /**
   * Az új él azonosítóját adó port (SPEC-008 5.8, M-101): az `onConnect` az
   * `addEdge` dokumentált `getEdgeId` opciójával adja át, tehát a könyvtár
   * `xy-edge__` előtagú azonosítója nem keletkezik. Az ok a globális
   * egyediség: a `workflow_edge.id` globális elsődleges kulcs.
   */
  readonly graphElementIdGenerator: GraphElementIdGenerator;
  /**
   * A jobb klikk menüből választott új csomópont típusa és helye (SPEC-008
   * 5.8): a csomópontot a szülő veszi fel és választja ki, a "Hozzáadás" gomb
   * útjával közös kezelőben.
   */
  readonly onAddNode: AddNodeContextMenuProperties['onAddNode'];
}

/**
 * A jobb klikk menü a `<ReactFlow>` gyerekeként, mert a `screenToFlowPosition`
 * a `useReactFlow()` hookból jön, ami csak a React Flow saját context
 * providere alatt hívható (a `FitViewOnAutoLayout` indoka).
 */
function PaneAddNodeContextMenu(
  properties: Readonly<Omit<AddNodeContextMenuProperties, 'screenToFlowPosition'>>,
): ReactElement {
  const { screenToFlowPosition } = useReactFlow();
  return <AddNodeContextMenu {...properties} screenToFlowPosition={screenToFlowPosition} />;
}

/**
 * A vezérelt vászon (SPEC-008 5.5, M-55): a `nodes` és az `edges` a szülő
 * állapota, a vászon a React Flow saját dokumentált "Controlled Flow"
 * mintáját követi - a GRÁF állapotát nem duplikálja, minden gráf változás
 * (`applyNodeChanges`, AC9) egy lépésben, közvetlenül az
 * `onGraphChange`-en át jut vissza a szülőhöz. Három saját állapota van, és
 * egyik sem gráf adat, tehát egyik sem mentődik: a mért csomópont méret
 * (`measured-node-sizes.ts`), a kiválasztott élek halmaza
 * (`graph-selection.ts`) és a jobb klikk menü nyitási pontja. Az `onConnect` az `addEdge`
 * segédfüggvényt hívja (M-58) a `getEdgeId` opcióval (M-101); a `branchKey` mezőt a `flowEdgeToWorkflowEdge`
 * tölti ki a `sourceHandle` értékéből (AC10). Az `isValidConnection` a
 * katalógus és a meglévő élek adatából dönt, gráf szemantika nélkül (AC11,
 * SPEC-008 5.4).
 */
export function GraphEditorCanvas(properties: Readonly<GraphEditorCanvasProperties>): ReactElement {
  const {
    nodes,
    edges,
    onGraphChange,
    selectedNodeId,
    onSelectNode,
    autoLayoutRevision,
    graphElementIdGenerator,
    onAddNode,
  } = properties;

  // A React Flow által mért csomópont méret a vászon SAJÁT nézeti állapota,
  // nem domain adat: a `WorkflowNodeInput` nem hordozza, tehát a vezérelt
  // oda-vissza leképezésen elveszne. A `measured-node-sizes.ts` doksija írja
  // le, mi történik enélkül (tartósan rejtett csomópont, nulla él, végtelen
  // `ResizeObserver` hurok, saját méréssel igazolva).
  const [measuredNodeSizes, setMeasuredNodeSizes] = useState<MeasuredNodeSizes>({});
  // A kiválasztott élek szintén a vászon nézeti állapota, ugyanabból az okból:
  // a `WorkflowEdgeInput` nem hordoz `selected` mezőt, tehát a vezérelt
  // oda-vissza leképezésen elveszne. A `graph-selection.ts` doksija írja le,
  // mi történik enélkül (kattintásra sem kiválasztható, tehát Backspace-szel
  // sem törölhető él, saját méréssel igazolva).
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<SelectedEdgeIds>(() => new Set());
  // A jobb klikk menü nyitási pontja (kliens koordináta), `undefined` esetén
  // zárva. Az `onPaneContextMenu` csak a vászon üres területén fut: a React
  // Flow a csomópont és az él jobb klikkjét nem adja tovább neki (M-97).
  const [contextMenuPoint, setContextMenuPoint] = useState<ContextMenuPosition | undefined>(undefined);

  const flowNodes = useMemo(
    () => nodes.map((node) => withMeasuredNodeSize(workflowNodeToFlowNode(node), measuredNodeSizes[node.id])),
    [nodes, measuredNodeSizes],
  );
  const flowEdges = useMemo(() => edges.map((edge) => workflowEdgeToFlowEdge(edge)), [edges]);

  const onNodesChange = useCallback(
    (changes: NodeChange<GraphNodeCardFlowNode>[]) => {
      // A `dimensions` változás mérési eredmény, a `select` változás
      // kiválasztás: egyik sem gráf szerkesztés, tehát a domain állapotot
      // egyik sem piszkolja be.
      // A `remove` változás sem itt dől el: lásd az `onDelete` kezelőt.
      const dimensionChanges: NodeDimensionChange[] = [];
      const selectionChanges: NodeSelectionChange[] = [];
      const graphChanges: NodeChange<GraphNodeCardFlowNode>[] = [];
      for (const change of changes) {
        if (change.type === 'dimensions') {
          dimensionChanges.push(change);
        } else if (change.type === 'select') {
          selectionChanges.push(change);
        } else if (change.type !== 'remove') {
          graphChanges.push(change);
        }
      }
      if (dimensionChanges.length > 0) {
        setMeasuredNodeSizes((previous) => mergeMeasuredNodeSizes(previous, dimensionChanges));
      }
      if (isNodeDeselected(selectionChanges, selectedNodeId)) {
        onSelectNode(undefined);
      }
      if (graphChanges.length > 0) {
        const nextFlowNodes = applyNodeChanges(graphChanges, flowNodes);
        // A húzás közbeni változás `dragging: true`, a húzás vége és a
        // billentyűs mozgatás `dragging: false` (`updateNodePositions`,
        // M-117): az utóbbi zárja a menetet, menet nélkül önálló lépés.
        const isDragging = graphChanges.some((change) => change.type === 'position' && change.dragging === true);
        onGraphChange(
          nextFlowNodes.map((node) => flowNodeToWorkflowNode(node)),
          edges,
          { key: NODE_DRAG_SESSION_KEY, isFinal: !isDragging },
        );
      }
    },
    [flowNodes, edges, onGraphChange, selectedNodeId, onSelectNode],
  );

  const onEdgesChange = useCallback((changes: EdgeChange<Edge>[]) => {
    // Az él egyetlen saját változása a `select`: kiválasztás, nem gráf
    // szerkesztés, tehát a saját nézeti állapotba megy, nem a domain alakba
    // (ahol a `selected` mező úgyis elveszne). A `remove` változást az
    // `onDelete` kezeli, más élváltozás ebben a szerkesztőben nem keletkezik.
    const selectionChanges: EdgeSelectionChange[] = [];
    for (const change of changes) {
      if (change.type === 'select') {
        selectionChanges.push(change);
      }
    }
    if (selectionChanges.length > 0) {
      setSelectedEdgeIds((previous) => mergeEdgeSelection(previous, selectionChanges));
    }
  }, []);

  const onConnect = useCallback(
    (connection: Connection) => {
      const nextFlowEdges = addEdge(connection, flowEdges, { getEdgeId: graphElementIdGenerator });
      onGraphChange(
        nodes,
        nextFlowEdges.map((edge) => flowEdgeToWorkflowEdge(edge)),
      );
    },
    [flowEdges, nodes, onGraphChange, graphElementIdGenerator],
  );

  // A billentyűs törlés egyetlen útja (SPEC-008 5.9). A könyvtár a törlést
  // két külön változáslistában jelzi (előbb az élek, utána a csomópontok);
  // ha mindkettő a saját, azonos renderből való propjaiból építené a
  // gráfot, a második hívás visszaírná az első törölt elemeit (a törölt
  // csomópont élei a gráfban maradnának). Az `onDelete` a kettőt együtt
  // kapja, ezért egyetlen `onGraphChange` hívás adja a törlés eredményét.
  const onDelete = useCallback(
    ({ nodes: deletedNodes, edges: deletedEdges }: { nodes: GraphNodeCardFlowNode[]; edges: Edge[] }) => {
      const deletedNodeIds = new Set(deletedNodes.map((node) => node.id));
      const deletedEdgeIds = new Set(deletedEdges.map((edge) => edge.id));
      onGraphChange(
        nodes.filter((node) => !deletedNodeIds.has(node.id)),
        edges.filter((edge) => !deletedEdgeIds.has(edge.id)),
      );
    },
    [nodes, edges, onGraphChange],
  );

  const isValidConnection = useCallback(
    (connectionOrEdge: Edge | Connection) => isValidGraphConnection(connectionOrEdge, flowNodes, flowEdges),
    [flowNodes, flowEdges],
  );

  const handlePaneContextMenu = useCallback((event: ReactMouseEvent | MouseEvent) => {
    // A böngésző saját menüje helyett a felvételi menü nyílik (SPEC-008 5.8).
    event.preventDefault();
    setContextMenuPoint({ x: event.clientX, y: event.clientY });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenuPoint(undefined);
  }, []);

  const displayedNodes = useMemo(
    () => flowNodes.map((node) => ({ ...node, selected: node.id === selectedNodeId })),
    [flowNodes, selectedNodeId],
  );
  const displayedEdges = useMemo(
    () => flowEdges.map((edge) => ({ ...edge, selected: selectedEdgeIds.has(edge.id) })),
    [flowEdges, selectedEdgeIds],
  );

  return (
    <div className="graph-editor-canvas graph-canvas-theme">
      {/* A mért kártya méret konstans CSS custom propertyvé fordítása, a
          `graph-node-card` téma egyetlen komponensében (a futás nézet csak
          olvasható vászna ugyanezt használja, T-009-20). */}
      <GraphNodeCardSizeStyle />
      <ReactFlow
        nodes={displayedNodes}
        edges={displayedEdges}
        nodeTypes={NODE_TYPES}
        /* A betöltött gráf beleillik a vászonba, ahelyett hogy az
           alapértelmezett `{ x: 0, y: 0, zoom: 1 }` nézetben a jobb szélen
           levágódna. A prop dokumentált jelentése: "When `true`, the flow
           will be zoomed and panned to fit all the nodes initially provided"
           (`@xyflow/react` `component-props.d.ts`). Kitalált nagyítási szám
           nincs: a `defaultViewport` és a `minZoom`/`maxZoom` a könyvtár
           alapértelmezésén marad. */
        fitView
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        deleteKeyCode={DELETE_KEY_CODE}
        onDelete={onDelete}
        isValidConnection={isValidConnection}
        onNodeClick={(_event, node) => {
          onSelectNode(node.id);
        }}
        onPaneClick={() => {
          onSelectNode(undefined);
        }}
        onPaneContextMenu={handlePaneContextMenu}
      >
        <Background />
        <Controls />
        {/* A `<ReactFlow>` GYEREKEKÉNT áll, mert a `useReactFlow()` hook
            kizárólag a React Flow saját context providere alatt hívható - az
            pedig magán a `<ReactFlow>`-n belül épül fel, tehát EBBŐL a
            komponensből (ami rendereli) nem érhető el. */}
        <FitViewOnAutoLayout revision={autoLayoutRevision} />
        {contextMenuPoint !== undefined && (
          <PaneAddNodeContextMenu point={contextMenuPoint} onAddNode={onAddNode} onClose={closeContextMenu} />
        )}
      </ReactFlow>
    </div>
  );
}
