import type { WorkflowGraph } from '@easter-workflow-builder/db';
import type { WorkflowGraphDocument } from '@easter-workflow-builder/protocol';

/**
 * A `db` réteg `WorkflowGraph`-ját (a `readGraph` eredménye) a drótszintű
 * `WorkflowGraphDocument` alakra képezi (SPEC-005 `workflow` téma, 4.2 A
 * táblázat 7. és 8. sora). A `config` mező mindkét oldalon típusos
 * `NodeConfig`, de két, önállóan deklarált unió (a `db` sajátja és a
 * `protocol` PLAN-009 T-009-13 óta duplikált mirror sémája,
 * `workflow-graph-document.ts` doksija): az átadás azért típusbiztos
 * szűkítés nélkül is helyes, mert a két oldal szerkezeti egyezését az
 * `apps/server` `node-config-drift-protection` regressziós tesztje
 * kényszeríti ki.
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
