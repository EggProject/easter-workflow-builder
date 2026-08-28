import type { ExecutableGraph } from './executable-graph.ts';

// Egy node kimenő élei közül azok a célpontok, amiket a bejárás még nem
// látott. A `reachable` halmazt menet közben frissíti, ezért ugyanaz a node
// egyetlen hullámba sem kerül be kétszer.
function collectUnseenTargets(graph: ExecutableGraph, nodeId: string, reachable: Set<string>): readonly string[] {
  const discovered: string[] = [];
  const outgoing = graph.outgoingEdges.get(nodeId) ?? [];

  for (const edge of outgoing) {
    if (reachable.has(edge.targetNodeId)) {
      continue;
    }
    reachable.add(edge.targetNodeId);
    discovered.push(edge.targetNodeId);
  }

  return discovered;
}

/**
 * A `fromNodeId` node-ból az élek irányában elérhető node azonosítók halmaza,
 * a kiindulási node-ot is beleértve. Szélességi bejárás a **teljes**
 * élhalmazon: a visszaéleket (SPEC-004 4.6) nem különbözteti meg, mert az
 * elérhetőség kérdése független attól, hogy egy él visszaél-e. A látogatott
 * halmaz zárja le a bejárást, ezért a kör nem okoz végtelen futást.
 *
 * Három helyen ez az egyetlen bejárási primitív: a visszaél keresés a `loop`
 * node-ból, a ciklustörzs kiszámítása a `continue` élek célpontjaiból, és a
 * SPEC-004 4.7 `unreachable_node` ellenőrzése a `start` node-ból. Az utóbbi
 * hibaágát a `run-validation` téma adja (PLAN-005 T-005-15), itt csak a nyers
 * halmaz áll elő.
 *
 * A halmaz tartalmazhat olyan azonosítót, amihez nincs node a `nodesById`
 * térképben: egy nem létező node-ra mutató él célpontja is elérhetőnek
 * számít, mert a `dangling_edge` ellenőrzés máshol dől el.
 */
export function computeReachableNodeIds(graph: ExecutableGraph, fromNodeId: string): ReadonlySet<string> {
  const reachable = new Set<string>([fromNodeId]);
  let frontier: readonly string[] = [fromNodeId];

  while (frontier.length > 0) {
    const nextFrontier: string[] = [];
    for (const nodeId of frontier) {
      nextFrontier.push(...collectUnseenTargets(graph, nodeId, reachable));
    }
    frontier = nextFrontier;
  }

  return reachable;
}
