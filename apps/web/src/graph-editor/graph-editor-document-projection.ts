import type {
  WorkflowEdge,
  WorkflowEdgeInput,
  WorkflowNode,
  WorkflowNodeInput,
} from '@easter-workflow-builder/protocol';

/**
 * A betöltött `WorkflowGraphDocument` (`WorkflowNode`/`WorkflowEdge`, a
 * szerver által hozzáadott `createdAtMs`/`updatedAtMs` mezővel) vetítése a
 * szerkesztő bemeneti alakjára (`WorkflowNodeInput`/`WorkflowEdgeInput`), amit
 * a `GraphEditorCanvas.onGraphChange` is termel - ez teszi összehasonlíthatóvá
 * a betöltött (mentetlen jelző alapja) és a szerkesztett dokumentumot
 * (SPEC-008 5.5, T-009-17).
 */
export function workflowNodeToNodeInput(node: WorkflowNode): WorkflowNodeInput {
  return {
    id: node.id,
    type: node.type,
    label: node.label,
    positionX: node.positionX,
    positionY: node.positionY,
    config: node.config,
  };
}

export function workflowEdgeToEdgeInput(edge: WorkflowEdge): WorkflowEdgeInput {
  return {
    id: edge.id,
    sourceNodeId: edge.sourceNodeId,
    targetNodeId: edge.targetNodeId,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    branchKey: edge.branchKey,
  };
}
