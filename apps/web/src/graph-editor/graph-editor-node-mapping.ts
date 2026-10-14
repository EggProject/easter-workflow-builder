import type { WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import type { GraphNodeCardFlowNode } from '../graph-node-card/graph-node-card-data.ts';

/**
 * A `WorkflowNodeInput` és a vászon `Node` alakja közötti oda-vissza
 * leképezés (SPEC-008 5.5). Tiszta függvények, DOM és `@xyflow/react`
 * hivatkozás nélkül a mért geometriára - csak a típusait importálja.
 *
 * A `start` csomópont vászon alakja `deletable: false` (SPEC-008 5.9, M-96):
 * sem a billentyű, sem az `onNodesChange` nem törli, és a rá kötött élek is
 * maradnak, hacsak nem maguk vannak kiválasztva.
 */
export function workflowNodeToFlowNode(workflowNode: WorkflowNodeInput): GraphNodeCardFlowNode {
  return {
    id: workflowNode.id,
    type: 'workflowNode',
    position: { x: workflowNode.positionX, y: workflowNode.positionY },
    deletable: workflowNode.type !== 'start',
    data: { workflowNode },
  };
}

/**
 * A visszaút: a vászon állapotából épített `WorkflowNodeInput`, a node
 * pozíciójával felülírva. A `data.workflowNode` minden más mezőt megőriz
 * (a beállítás panel ott módosítja a `config`-ot, nem itt).
 */
export function flowNodeToWorkflowNode(flowNode: GraphNodeCardFlowNode): WorkflowNodeInput {
  return {
    ...flowNode.data.workflowNode,
    positionX: flowNode.position.x,
    positionY: flowNode.position.y,
  };
}
