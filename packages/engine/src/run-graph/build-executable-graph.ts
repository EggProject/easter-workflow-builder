import type { GraphSnapshotDocument, SnapshotEdge, SnapshotNode } from '@easter-workflow-builder/db';
import type { ExecutableGraph } from './executable-graph.ts';

// Egy él hozzáfűzése a node azonosítóhoz tartozó listához, a lista első
// elemének létrehozásával együtt.
function appendEdge(edgesByNodeId: Map<string, SnapshotEdge[]>, nodeId: string, edge: SnapshotEdge): void {
  const edges = edgesByNodeId.get(nodeId);
  if (edges === undefined) {
    edgesByNodeId.set(nodeId, [edge]);
  } else {
    edges.push(edge);
  }
}

/**
 * A pillanatkép átindexelése végrehajtható gráf alakra (SPEC-004 4.1).
 *
 * Tiszta, mindig sikeres átalakítás, ezért nincs `Outcome` burkolója: a
 * függvény pusztán a nyers node és él tömböket rendezi térképekbe. Nem
 * létező node-ra mutató él nem hiba ezen a szinten (lásd az `ExecutableGraph`
 * dokumentációját), és az él listák sorrendje a pillanatképé marad.
 */
export function buildExecutableGraph(document: GraphSnapshotDocument): ExecutableGraph {
  const nodesById = new Map<string, SnapshotNode>();
  for (const node of document.nodes) {
    nodesById.set(node.id, node);
  }

  const outgoingEdges = new Map<string, SnapshotEdge[]>();
  const incomingEdges = new Map<string, SnapshotEdge[]>();
  for (const edge of document.edges) {
    appendEdge(outgoingEdges, edge.sourceNodeId, edge);
    appendEdge(incomingEdges, edge.targetNodeId, edge);
  }

  return { nodesById, outgoingEdges, incomingEdges };
}
