import type { WorkflowEdgeInput, WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Controls,
  ReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
  type NodeDimensionChange,
} from '@xyflow/react';
import { useCallback, useMemo, useState, type ReactElement } from 'react';
import { GraphNodeCard } from '../graph-node-card/GraphNodeCard.tsx';
import type { GraphNodeCardFlowNode } from '../graph-node-card/graph-node-card-data.ts';
import { GRAPH_NODE_CARD_HEIGHT, GRAPH_NODE_CARD_WIDTH } from '../graph-node-catalog/graph-node-catalog.ts';
import { flowEdgeToWorkflowEdge, workflowEdgeToFlowEdge } from './graph-editor-edge-mapping.ts';
import { flowNodeToWorkflowNode, workflowNodeToFlowNode } from './graph-editor-node-mapping.ts';
import { isValidGraphConnection } from './is-valid-connection.ts';
import { mergeMeasuredNodeSizes, withMeasuredNodeSize, type MeasuredNodeSizes } from './measured-node-sizes.ts';
import '@xyflow/react/dist/style.css';
import './graph-editor.css';

/**
 * A vászon egyetlen node típusa, modul szintű `const` (M-56): a
 * `GraphEditorCanvas` sosem hozza létre újra render közben, tehát a
 * hivatkozás két render között azonos marad, és a React Flow nem építi
 * újra a teljes vásznat minden szülő rendernél (AC8).
 */
const NODE_TYPES = { workflowNode: GraphNodeCard };

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
   * a `graph-editor-screen` témában, T-009-17).
   */
  readonly onGraphChange: (nodes: readonly WorkflowNodeInput[], edges: readonly WorkflowEdgeInput[]) => void;
  /**
   * A kiválasztott csomópont azonosítója - a beállítás panel (`node-inspector`,
   * T-009-18) ez alapján dönti el, mit szerkeszt. A vászon ezt vizuálisan is
   * kiemeli (`Node.selected`).
   */
  readonly selectedNodeId: string | undefined;
  readonly onSelectNode: (nodeId: string | undefined) => void;
}

/**
 * A vezérelt vászon (SPEC-008 5.5, M-55): a `nodes` és az `edges` a szülő
 * állapota, a vászon a React Flow saját dokumentált "Controlled Flow"
 * mintáját követi - a GRÁF állapotát nem duplikálja, minden gráf változás
 * (`applyNodeChanges`, `applyEdgeChanges`, AC9) egy lépésben, közvetlenül az
 * `onGraphChange`-en át jut vissza a szülőhöz. Az egyetlen saját állapot a
 * mért csomópont méret, ami nem gráf adat és nem is mentődik
 * (`measured-node-sizes.ts`). Az `onConnect` az `addEdge`
 * segédfüggvényt hívja (M-58); a `branchKey` mezőt a `flowEdgeToWorkflowEdge`
 * tölti ki a `sourceHandle` értékéből (AC10). Az `isValidConnection` a
 * katalógus és a meglévő élek adatából dönt, gráf szemantika nélkül (AC11,
 * SPEC-008 5.4).
 */
export function GraphEditorCanvas(properties: Readonly<GraphEditorCanvasProperties>): ReactElement {
  const { nodes, edges, onGraphChange, selectedNodeId, onSelectNode } = properties;

  // A React Flow által mért csomópont méret a vászon SAJÁT nézeti állapota,
  // nem domain adat: a `WorkflowNodeInput` nem hordozza, tehát a vezérelt
  // oda-vissza leképezésen elveszne. A `measured-node-sizes.ts` doksija írja
  // le, mi történik enélkül (tartósan rejtett csomópont, nulla él, végtelen
  // `ResizeObserver` hurok, saját méréssel igazolva).
  const [measuredNodeSizes, setMeasuredNodeSizes] = useState<MeasuredNodeSizes>({});

  const flowNodes = useMemo(
    () => nodes.map((node) => withMeasuredNodeSize(workflowNodeToFlowNode(node), measuredNodeSizes[node.id])),
    [nodes, measuredNodeSizes],
  );
  const flowEdges = useMemo(() => edges.map((edge) => workflowEdgeToFlowEdge(edge)), [edges]);

  const onNodesChange = useCallback(
    (changes: NodeChange<GraphNodeCardFlowNode>[]) => {
      // A `dimensions` változás mérési eredmény, nem gráf szerkesztés: a mért
      // méret térképbe megy, a domain állapotot nem piszkolja be.
      const dimensionChanges: NodeDimensionChange[] = [];
      const graphChanges: NodeChange<GraphNodeCardFlowNode>[] = [];
      for (const change of changes) {
        if (change.type === 'dimensions') {
          dimensionChanges.push(change);
        } else {
          graphChanges.push(change);
        }
      }
      if (dimensionChanges.length > 0) {
        setMeasuredNodeSizes((previous) => mergeMeasuredNodeSizes(previous, dimensionChanges));
      }
      if (graphChanges.length > 0) {
        const nextFlowNodes = applyNodeChanges(graphChanges, flowNodes);
        onGraphChange(
          nextFlowNodes.map((node) => flowNodeToWorkflowNode(node)),
          edges,
        );
      }
    },
    [flowNodes, edges, onGraphChange],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => {
      const nextFlowEdges = applyEdgeChanges(changes, flowEdges);
      onGraphChange(
        nodes,
        nextFlowEdges.map((edge) => flowEdgeToWorkflowEdge(edge)),
      );
    },
    [flowEdges, nodes, onGraphChange],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const nextFlowEdges = addEdge(connection, flowEdges);
      onGraphChange(
        nodes,
        nextFlowEdges.map((edge) => flowEdgeToWorkflowEdge(edge)),
      );
    },
    [flowEdges, nodes, onGraphChange],
  );

  const isValidConnection = useCallback(
    (connectionOrEdge: Edge | Connection) => isValidGraphConnection(connectionOrEdge, flowNodes, flowEdges),
    [flowNodes, flowEdges],
  );

  const displayedNodes = useMemo(
    () => flowNodes.map((node) => ({ ...node, selected: node.id === selectedNodeId })),
    [flowNodes, selectedNodeId],
  );

  return (
    <div className="graph-editor-canvas">
      {/* A `graph-node-catalog` téma egyetlen mért kártya méret konstansát
          (T-009-19, SPEC-008 5.7, AC62) egy `:root` custom property párra
          fordítja - a `graph-node-card.css` ezt olvassa `min-width`/
          `min-height`-ként. Ez az EGYETLEN hely, ahol a két szám a CSS felé
          eljut; a dagre hívás (`graph-auto-layout` téma) ugyanezt a
          konstanst importálja közvetlenül, szám duplikáció nélkül. */}
      <style>{`:root { --graph-node-card-width: ${String(GRAPH_NODE_CARD_WIDTH)}px; --graph-node-card-height: ${String(GRAPH_NODE_CARD_HEIGHT)}px; }`}</style>
      <ReactFlow
        nodes={displayedNodes}
        edges={flowEdges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onNodeClick={(_event, node) => {
          onSelectNode(node.id);
        }}
        onPaneClick={() => {
          onSelectNode(undefined);
        }}
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
