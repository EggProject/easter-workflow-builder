/* eslint-disable unicorn/no-null -- a WorkflowEdgeInput nullázható mezői a dróton ténylegesen `null` értéket hordoznak, nem helyőrző `undefined`-et (SPEC-005) */
import type { WorkflowEdgeInput } from '@easter-workflow-builder/protocol';
import type { Edge } from '@xyflow/react';

/**
 * A `WorkflowEdgeInput` és a vászon `Edge` alakja közötti oda-vissza
 * leképezés (SPEC-008 5.1, 5.5). A vászon él objektumán nincs önálló
 * `branchKey` mező: az azonosító maga a `sourceHandle` (M-58), tehát a
 * `branchKey` a `sourceHandle`-ből derivált, nem külön tárolt adat.
 */
export function workflowEdgeToFlowEdge(edge: WorkflowEdgeInput): Edge {
  return {
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
  };
}

/**
 * A visszaút: az `onConnect` a `sourceHandle` értékéből tölti ki a
 * `branchKey` mezőt (SPEC-008 5.1 "A kimenő handle azonosítója a
 * `branchKey` értéke", AC10). A hiányzó (`undefined`) mező a dróton `null`.
 */
export function flowEdgeToWorkflowEdge(flowEdge: Edge): WorkflowEdgeInput {
  const sourceHandle = flowEdge.sourceHandle ?? null;
  return {
    id: flowEdge.id,
    sourceNodeId: flowEdge.source,
    targetNodeId: flowEdge.target,
    sourceHandle,
    targetHandle: flowEdge.targetHandle ?? null,
    branchKey: sourceHandle,
  };
}
