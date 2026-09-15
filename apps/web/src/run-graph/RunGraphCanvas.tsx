import type { WorkflowEdgeInput } from '@easter-workflow-builder/protocol';
import { Background, Controls, ReactFlow, type NodeChange, type NodeDimensionChange } from '@xyflow/react';
import { useCallback, useMemo, useState, type ReactElement } from 'react';
import { GraphNodeCard } from '../graph-node-card/GraphNodeCard.tsx';
import { GraphNodeCardSizeStyle } from '../graph-node-card/GraphNodeCardSizeStyle.tsx';
import type { GraphNodeCardData, GraphNodeCardFlowNode } from '../graph-node-card/graph-node-card-data.ts';
import { workflowEdgeToFlowEdge } from '../graph-editor/graph-editor-edge-mapping.ts';
import {
  mergeMeasuredNodeSizes,
  withMeasuredNodeSize,
  type MeasuredNodeSizes,
} from '../graph-editor/measured-node-sizes.ts';
import '@xyflow/react/dist/style.css';
import './run-graph.css';

/**
 * A futás nézet vászna ugyanazt az egyetlen egyedi node komponenst
 * regisztrálja, mint a szerkesztő (SPEC-008 5.1), modul szintű `const`-ként,
 * hogy a hivatkozás két render között azonos maradjon (M-56).
 */
const NODE_TYPES = { workflowNode: GraphNodeCard };

export interface RunGraphCanvasProperties {
  /**
   * A pillanatkép csomópontjai, a lépés futásokból származó dekorációval
   * együtt (`build-run-graph-nodes.ts`).
   */
  readonly nodes: readonly GraphNodeCardData[];
  readonly edges: readonly WorkflowEdgeInput[];
}

/**
 * A futás pillanatképéből épülő, CSAK OLVASHATÓ vászon (SPEC-008 6.2, AC19,
 * AC20). Három prop kapcsolja ki a szerkesztést: `nodesDraggable`,
 * `nodesConnectable` és `elementsSelectable`, mindhárom hamis. A vászon
 * PÁSZTÁZHATÓ és NAGYÍTHATÓ marad, mert az nem szerkesztés, hanem a nagy
 * gráfok megtekintésének egyetlen módja.
 *
 * **A mért csomópont méret itt is nézeti állapot**, ugyanabból az okból, mint
 * a szerkesztőben (`graph-editor/measured-node-sizes.ts` doksija): a `nodes`
 * prop minden lépés futás frissüléskor új objektumokból épül újra, `measured`
 * mező nélkül, és a React Flow a belső node-ot a propként kapott objektumból
 * építi újra. Mért méret nélkül a csomópont tartósan `visibility: hidden`
 * marad, egyetlen él sem rajzolódik ki, és a mérési hurok nem konvergál. A
 * modul ezért a `graph-editor` téma már mért, tesztelt segédfüggvényeit
 * használja, nem egy másolatot; az import irány egyirányú (`run-graph` ->
 * `graph-editor`).
 *
 * **Egyetlen ág sem függ mért csomópont geometriától** (SPEC-008 12.2): a
 * `measured.` tulajdonság-elérés és a `getBoundingClientRect(` hívás
 * egyaránt hiányzik, a mért méret kizárólag a React Flow saját `dimensions`
 * változásából jut a térképbe.
 */
export function RunGraphCanvas(properties: Readonly<RunGraphCanvasProperties>): ReactElement {
  const { nodes, edges } = properties;

  const [measuredNodeSizes, setMeasuredNodeSizes] = useState<MeasuredNodeSizes>({});

  const flowNodes = useMemo(
    () =>
      nodes.map((data) =>
        withMeasuredNodeSize(
          {
            id: data.workflowNode.id,
            type: 'workflowNode',
            position: { x: data.workflowNode.positionX, y: data.workflowNode.positionY },
            data,
          },
          measuredNodeSizes[data.workflowNode.id],
        ),
      ),
    [nodes, measuredNodeSizes],
  );
  const flowEdges = useMemo(() => edges.map((edge) => workflowEdgeToFlowEdge(edge)), [edges]);

  // A csak olvasható vásznon a React Flow egyetlen érdemi változást küld: a
  // `dimensions` típusú mérési eredményt. Minden más változás típus (húzás,
  // kiválasztás, kapcsolás) a három kikapcsoló prop miatt nem keletkezhet,
  // ezért a kezelő azokat egyszerűen elhagyja - nem hibaág, hanem szűrés.
  const onNodesChange = useCallback((changes: NodeChange<GraphNodeCardFlowNode>[]) => {
    const dimensionChanges: NodeDimensionChange[] = [];
    for (const change of changes) {
      if (change.type === 'dimensions') {
        dimensionChanges.push(change);
      }
    }
    if (dimensionChanges.length > 0) {
      setMeasuredNodeSizes((previous) => mergeMeasuredNodeSizes(previous, dimensionChanges));
    }
  }, []);

  return (
    <div className="run-graph-canvas">
      <GraphNodeCardSizeStyle />
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        /* A betöltött pillanatkép beleillik a vászonba, ahelyett hogy az
           alapértelmezett `{ x: 0, y: 0, zoom: 1 }` nézetben a jobb szélen
           levágódna. A prop dokumentált jelentése kizárólag a KEZDETI nézetre
           szól; a futás nézetben nincs olyan művelet, ami a pozíciókat
           átírná, tehát későbbi újraillesztésre sincs szükség. */
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
