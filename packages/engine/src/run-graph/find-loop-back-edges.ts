import { computeReachableNodeIds } from './compute-reachable-node-ids.ts';
import type { ExecutableGraph } from './executable-graph.ts';

/**
 * A visszaélek azonosítói, a SPEC-004 4.6 szekció definíciója szerint: egy
 * `e = (u -> v)` él **visszaél**, ha `v` típusa `loop`, és `u` elérhető
 * `v`-ből az élek irányában.
 *
 * Ez a 4.6 validációs sorrend első lépése. Az elérhetőségi bejárás a
 * kiinduló, még nyers gráfon megy, a körökkel együtt, visszaél szűrés nélkül:
 * enélkül a definíció önmagára hivatkozna. A visszatérési halmaz a
 * `SnapshotEdge.id` értékeket tartalmazza, mert a rákövetkező lépések
 * (`detectGraphCycle`, `validateLoopBackEdgeBody`) élenként döntenek.
 */
export function findLoopBackEdges(graph: ExecutableGraph): ReadonlySet<string> {
  const loopBackEdgeIds = new Set<string>();

  for (const node of graph.nodesById.values()) {
    if (node.type !== 'loop') {
      continue;
    }
    const reachableFromLoop = computeReachableNodeIds(graph, node.id);
    const incoming = graph.incomingEdges.get(node.id) ?? [];
    for (const edge of incoming) {
      if (reachableFromLoop.has(edge.sourceNodeId)) {
        loopBackEdgeIds.add(edge.id);
      }
    }
  }

  return loopBackEdgeIds;
}
