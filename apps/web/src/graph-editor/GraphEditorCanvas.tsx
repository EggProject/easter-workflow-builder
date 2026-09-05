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
} from '@xyflow/react';
import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { GraphNodeCard } from '../graph-node-card/GraphNodeCard.tsx';
import type { GraphNodeCardFlowNode } from '../graph-node-card/graph-node-card-data.ts';
import { flowEdgeToWorkflowEdge, workflowEdgeToFlowEdge } from './graph-editor-edge-mapping.ts';
import { flowNodeToWorkflowNode, workflowNodeToFlowNode } from './graph-editor-node-mapping.ts';
import { isValidGraphConnection } from './is-valid-connection.ts';
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
  readonly initialNodes: readonly WorkflowNodeInput[];
  readonly initialEdges: readonly WorkflowEdgeInput[];
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
 * A vezérelt vászon (SPEC-008 5.5, M-55): a `nodes` és az `edges` a
 * képernyő állapota, a változások az `applyNodeChanges` és az
 * `applyEdgeChanges` függvényen mennek át (AC9). Az `onConnect` az
 * `addEdge` segédfüggvényt hívja (M-58); a `branchKey` mezőt a
 * `flowEdgeToWorkflowEdge` tölti ki a `sourceHandle` értékéből, az
 * `onGraphChange` kimenetén (AC10). Az `isValidConnection` a katalógus és a
 * meglévő élek adatából dönt, gráf szemantika nélkül (AC11, SPEC-008 5.4).
 */
export function GraphEditorCanvas(properties: Readonly<GraphEditorCanvasProperties>): ReactElement {
  const { initialNodes, initialEdges, onGraphChange, selectedNodeId, onSelectNode } = properties;

  const [nodes, setNodes] = useState<GraphNodeCardFlowNode[]>(() =>
    initialNodes.map((node) => workflowNodeToFlowNode(node)),
  );
  const [edges, setEdges] = useState<Edge[]>(() => initialEdges.map((edge) => workflowEdgeToFlowEdge(edge)));

  // Az `onGraphChange` szándékosan nincs a dependency listán: a hívó
  // (`graph-editor-screen`, T-009-17) minden renderen új függvényt adhat,
  // ami végtelen ciklust okozna; a `nodes`/`edges` állapot a valódi kiváltó.
  // A projekt ESLint konfigurációja nem tartalmazza a `react-hooks/exhaustive-deps`
  // szabályt, tehát nincs mit letiltani - ez a megjegyzés csak a szándékos kihagyást dokumentálja.
  useEffect(() => {
    onGraphChange(
      nodes.map((node) => flowNodeToWorkflowNode(node)),
      edges.map((edge) => flowEdgeToWorkflowEdge(edge)),
    );
  }, [nodes, edges]);

  const onNodesChange = useCallback((changes: NodeChange<GraphNodeCardFlowNode>[]) => {
    setNodes((current) => applyNodeChanges(changes, current));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange<Edge>[]) => {
    setEdges((current) => applyEdgeChanges(changes, current));
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    setEdges((current) => addEdge(connection, current));
  }, []);

  const isValidConnection = useCallback(
    (connectionOrEdge: Edge | Connection) => isValidGraphConnection(connectionOrEdge, nodes, edges),
    [nodes, edges],
  );

  const displayedNodes = useMemo(
    () => nodes.map((node) => ({ ...node, selected: node.id === selectedNodeId })),
    [nodes, selectedNodeId],
  );

  return (
    <div className="graph-editor-canvas">
      <ReactFlow
        nodes={displayedNodes}
        edges={edges}
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
