import { computeReachableAvoiding } from './compute-reachable-avoiding.ts';
import { computeReachableNodeIds } from './compute-reachable-node-ids.ts';
import type { ExecutableGraph } from './executable-graph.ts';

/**
 * A visszaélek azonosítói, a SPEC-004 4.6 szekció dominancia alapú
 * definíciója szerint (user döntés 2026-10-21, O-10): egy `e = (u -> v)` él
 * **visszaél**, ha `v` típusa `loop`, és `v` **dominálja** `u`-t, azaz a
 * `start` node-ból `u`-ba vezető minden út áthalad `v`-n (egy node
 * triviálisan dominálja önmagát). A dominancia csak a `start` node-ból
 * elérhető `u`-ra értelmezett: az el nem érhető forrású él nem visszaél, azt a
 * 4.7 `unreachable_node` ellenőrzése fogja meg.
 *
 * **Miért nem a korábbi "`u` elérhető `v`-ből" definíció.** Beágyazott `loop`
 * esetén a belső `loop`-ból a külső visszaélen át a külső törzs is elérhető,
 * tehát a külső törzsből a belső `loop`-ra mutató, valójában belépő él is
 * visszaélnek minősült, és a belső `loop` örökre várt (mérve,
 * `docs/research/2026-10-21-spec010-blokkolo-meresek.md` 8. szekció). A belső
 * `loop` a külső törzs node-jait nem dominálja, ezért a dominancia alapú
 * definíció ezt az élt belépő élnek hagyja.
 *
 * Ez a 4.6 validációs sorrend első lépése, a nyers gráfon, a körökkel együtt.
 * A visszatérési halmaz a `SnapshotEdge.id` értékeket tartalmazza, mert a
 * rákövetkező lépések (`detectGraphCycle`, `validateLoopBackEdgeBody`)
 * élenként döntenek.
 */
export function findLoopBackEdges(graph: ExecutableGraph, startNodeId: string): ReadonlySet<string> {
  const loopBackEdgeIds = new Set<string>();
  const reachableFromStart = computeReachableNodeIds(graph, startNodeId);

  for (const node of graph.nodesById.values()) {
    if (node.type !== 'loop') {
      continue;
    }
    const reachableWithoutLoop = computeReachableAvoiding(graph, startNodeId, node.id);
    const incoming = graph.incomingEdges.get(node.id) ?? [];
    for (const edge of incoming) {
      const source = edge.sourceNodeId;
      if (reachableFromStart.has(source) && (source === node.id || !reachableWithoutLoop.has(source))) {
        loopBackEdgeIds.add(edge.id);
      }
    }
  }

  return loopBackEdgeIds;
}
