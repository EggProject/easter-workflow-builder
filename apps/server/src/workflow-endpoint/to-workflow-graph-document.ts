import type { WorkflowGraph } from '@easter-workflow-builder/db';
import type { WorkflowGraphDocument } from '@easter-workflow-builder/protocol';

/**
 * A `db` réteg `WorkflowGraph`-ját (a `readGraph` eredménye) a drótszintű
 * `WorkflowGraphDocument` alakra képezi (SPEC-005 `workflow` téma, 4.2 A
 * táblázat 7. és 8. sora). A `config` mező a `db`-ben típusos `NodeConfig`,
 * a dróton `unknown`: a `WorkflowNodeSchema.config` mezője `z.unknown()`
 * (`workflow-graph-document.ts` doksija), tehát az átadás típusbiztos
 * szűkítés nélkül is helyes.
 */
export function toWorkflowGraphDocument(graph: WorkflowGraph): WorkflowGraphDocument {
  return {
    nodes: graph.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      label: node.label,
      positionX: node.positionX,
      positionY: node.positionY,
      config: node.config,
      createdAtMs: node.createdAtMs.getTime(),
      updatedAtMs: node.updatedAtMs.getTime(),
    })),
    edges: graph.edges.map((edge) => ({
      id: edge.id,
      sourceNodeId: edge.sourceNodeId,
      targetNodeId: edge.targetNodeId,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      branchKey: edge.branchKey,
      createdAtMs: edge.createdAtMs.getTime(),
    })),
  };
}
