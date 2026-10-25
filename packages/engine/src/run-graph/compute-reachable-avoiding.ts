import type { ExecutableGraph } from './executable-graph.ts';

// Egy node kimenő élei közül azok a célpontok, amiket a bejárás még nem látott,
// az `avoidedNodeId` node kivételével (a `computeReachableNodeIds` bejárásának
// mintája). A `reachable` halmazt menet közben frissíti.
function collectUnseenTargetsAvoiding(
  graph: ExecutableGraph,
  nodeId: string,
  avoidedNodeId: string,
  reachable: Set<string>,
): readonly string[] {
  const discovered: string[] = [];
  const outgoing = graph.outgoingEdges.get(nodeId) ?? [];

  for (const edge of outgoing) {
    if (edge.targetNodeId === avoidedNodeId || reachable.has(edge.targetNodeId)) {
      continue;
    }
    reachable.add(edge.targetNodeId);
    discovered.push(edge.targetNodeId);
  }

  return discovered;
}

/**
 * A `fromNodeId` node-ból az élek irányában elérhető node azonosítók, az
 * `avoidedNodeId` node-on át vezető utak nélkül: a kihagyott node-ba nem lép
 * be a bejárás, tehát a kimenő élei sem számítanak. A kiindulási node mindig a
 * halmazban áll, akkor is, ha az a kihagyott node.
 *
 * Két felhasználása van a SPEC-004 4.6 szekciójában:
 *
 * - a dominancia (`findLoopBackEdges`): `v` pontosan akkor dominálja a
 *   `start`-ból elérhető `u`-t (`u` és `v` különböző), ha `u` nincs ebben a
 *   halmazban `fromNodeId = start`, `avoidedNodeId = v` mellett, mert akkor
 *   minden `start` -> `u` út áthalad `v`-n;
 * - a `loop` törzse (`validateLoopBackEdgeBody`): a `continue` élek
 *   célpontjaiból a `loop` node újbóli érintése nélkül elérhető node-ok, hogy
 *   a `loop` `exit` ágán álló node ne számítson a törzsbe.
 */
export function computeReachableAvoiding(
  graph: ExecutableGraph,
  fromNodeId: string,
  avoidedNodeId: string,
): ReadonlySet<string> {
  const reachable = new Set<string>([fromNodeId]);
  let frontier: readonly string[] = [fromNodeId];

  while (frontier.length > 0) {
    const nextFrontier: string[] = [];
    for (const nodeId of frontier) {
      nextFrontier.push(...collectUnseenTargetsAvoiding(graph, nodeId, avoidedNodeId, reachable));
    }
    frontier = nextFrontier;
  }

  return reachable;
}
