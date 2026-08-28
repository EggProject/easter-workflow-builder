import type { SnapshotEdge } from '@easter-workflow-builder/db';
import type { StepInstanceReference } from '../run-context/step-instance-reference.ts';
import { buildFanOutItemContext } from './build-fan-out-item-context.ts';
import { buildScopedKey } from './build-scoped-key.ts';
import type { EdgeMark } from './edge-mark.ts';
import type { InstanceReadiness } from './instance-readiness.ts';
import type { RunTopology } from './run-topology.ts';
import type { SchedulerState } from './scheduler-state.ts';

// Egy node bejövő élei. A `buildExecutableGraph` csak azokhoz a node-okhoz vesz
// fel bejegyzést, amikhez tartozik él, tehát a `start` node-ra a térkép semmit
// nem ad; a hiány üres listát jelent, nem hibát.
function incomingEdgesOf(topology: RunTopology, nodeId: string): readonly SnapshotEdge[] {
  return topology.graph.incomingEdges.get(nodeId) ?? [];
}

// A SPEC-004 4.4 2. és 3. pontja egyetlen jelöléslistán: hiányzó jelölés
// `waiting`, legalább egy `live` jelölés `live`, csupa `dead` jelölés `dead`.
function combineMarks(marks: readonly (EdgeMark | undefined)[]): InstanceReadiness {
  let hasLiveMark = false;

  for (const mark of marks) {
    if (mark === undefined) {
      return 'waiting';
    }
    if (mark === 'live') {
      hasLiveMark = true;
    }
  }

  return hasLiveMark ? 'live' : 'dead';
}

// A `join` node futtathatósága (SPEC-004 4.5): a `join` "bejövő élenként N
// jelölést vár, és egyszer fut le a külső kontextusban", ahol az N a párosított
// `fan_out` példány elemszáma. A jelölések a **belső** kontextusokban állnak,
// a `join` példány viszont a külső veremben, ezért a jelöléseket a
// `buildFanOutItemContext` állítja elő elemenként.
//
// Három bejegyzés nélküli, illetve rövidre záró eset van:
//
// - nincs kibontás bejegyzés: a párosított `fan_out` példány még nem futott le,
//   tehát a `join` vár;
// - `dead` kibontás: a `fan_out` példány halott ágban állt vagy hibára futott,
//   tehát a `join` példány is halott;
// - `N = 0`: a `join` azonnal futtatható, üres bemeneti listával, mert
//   "az üreslistás eset nem különleges ág a `join` végrehajtóban, hanem a
//   bemeneti lista hossza nulla".
function resolveJoinReadiness(
  state: SchedulerState,
  topology: RunTopology,
  instance: StepInstanceReference,
): InstanceReadiness {
  const fanOutNodeId = topology.fanOutJoinPairing.joinToFanOut.get(instance.nodeId);
  const expansion =
    fanOutNodeId === undefined
      ? undefined
      : state.fanOutExpansions.get(buildScopedKey(fanOutNodeId, instance.branchContext));

  if (expansion === undefined) {
    return 'waiting';
  }
  if (expansion.kind === 'dead') {
    return 'dead';
  }
  if (expansion.items.length === 0) {
    return 'live';
  }

  const incoming = incomingEdgesOf(topology, instance.nodeId);
  const marks: (EdgeMark | undefined)[] = [];

  for (const itemIndex of expansion.items.keys()) {
    const itemContext = buildFanOutItemContext(instance.branchContext, expansion.stepRunId, itemIndex);
    for (const edge of incoming) {
      marks.push(state.edgeMarks.get(buildScopedKey(edge.id, itemContext)));
    }
  }

  return combineMarks(marks);
}

/**
 * Egy node példány futtathatósága a bejövő jelölései alapján
 * (SPEC-004 4.4 2. és 3. pont). Tiszta függvény: az ütemező állapotát nem
 * módosítja, adatbázist és portot nem érint.
 *
 * **A `loop` node bejövő élei két csoportra bomlanak** (4.6, "A visszaél nem
 * vár"): a belépő élekre a szokásos "mindre vár" szabály áll, a visszaélek
 * viszont külön-külön indítanak egy újabb lefutást. Ez a függvény ezért
 * kizárólag a belépő éleket nézi, minden node típusnál; a visszaélen érkező
 * `live` jelölés az `advanceScheduler` dolga. Enélkül a `loop` az első belépés
 * után örökre a visszaélre várna.
 *
 * **Bejövő él nélküli példány `waiting`**, nem `dead`. Ez a `start` node esete:
 * a 3. pont "minden bejövő jelölés `dead`" feltétele üres élhalmazon
 * félrevezetően teljesülne, holott a `start` node példányát a 4.4 1. pontja
 * szerint az `enqueueStartInstance` teszi a sorba. Más node bejövő él nélkül
 * nem fordulhat elő, mert a futás indítási validáció `unreachable_node`
 * hibával elutasítja (4.7).
 */
export function resolveInstanceReadiness(
  state: SchedulerState,
  topology: RunTopology,
  instance: StepInstanceReference,
): InstanceReadiness {
  if (topology.graph.nodesById.get(instance.nodeId)?.type === 'join') {
    return resolveJoinReadiness(state, topology, instance);
  }

  const incoming = incomingEdgesOf(topology, instance.nodeId);
  const enteringEdges = incoming.filter((edge) => !topology.loopBackEdgeIds.has(edge.id));

  if (enteringEdges.length === 0) {
    return 'waiting';
  }

  return combineMarks(
    enteringEdges.map((edge) => state.edgeMarks.get(buildScopedKey(edge.id, instance.branchContext))),
  );
}
