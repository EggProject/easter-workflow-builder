import type { WorkflowEdgeInput, WorkflowNodeInput } from '@easter-workflow-builder/protocol';

/**
 * A csomópont és a rá kötött élek (bejövő és kimenő egyaránt) eltávolítása a
 * szerkesztett állapotból (SPEC-008 5.9). Tiszta függvény: a mentés utáni
 * `PUT` törzsében így nem marad a törölt csomópontra hivatkozó él (5.4 2.
 * pont). A Start védelme nem itt van: a vászon alakja `deletable: false`, a
 * panelen pedig nincs "Törlés" gomb.
 */
export function deleteNodeWithEdges(
  nodes: readonly WorkflowNodeInput[],
  edges: readonly WorkflowEdgeInput[],
  nodeId: string,
): { nodes: readonly WorkflowNodeInput[]; edges: readonly WorkflowEdgeInput[] } {
  return {
    nodes: nodes.filter((node) => node.id !== nodeId),
    edges: edges.filter((edge) => edge.sourceNodeId !== nodeId && edge.targetNodeId !== nodeId),
  };
}
