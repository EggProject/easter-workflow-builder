import type { Outcome } from '@easter-workflow-builder/core';
import type { SnapshotNode } from '@easter-workflow-builder/db';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';
import { computeReachableNodeIds } from './compute-reachable-node-ids.ts';
import type { ExecutableGraph } from './executable-graph.ts';

// A `loop` node törzsének node azonosítói: a `continue` `branchKey` értékű
// kimenő élek célpontjaiból indulva, onnantól a teljes élhalmazon haladva,
// bármilyen `branchKey` mentén. A törzs tehát a ciklusmagból elérhető rész,
// nem csak a `continue` élek lánca.
function computeLoopBodyNodeIds(graph: ExecutableGraph, loopNode: SnapshotNode): ReadonlySet<string> {
  const body = new Set<string>();
  const outgoing = graph.outgoingEdges.get(loopNode.id) ?? [];

  for (const edge of outgoing) {
    if (edge.branchKey !== 'continue') {
      continue;
    }
    for (const bodyNodeId of computeReachableNodeIds(graph, edge.targetNodeId)) {
      body.add(bodyNodeId);
    }
  }

  return body;
}

/**
 * A visszaél törzsön belüliségének ellenőrzése (SPEC-004 4.6, a validációs
 * sorrend 3. lépése): "Minden visszaél forrásának a `loop` node törzsében kell
 * lennie, azaz elérhetőnek a `loop` node `continue` élein át." Ha nem, a hiba
 * `loop_back_edge_outside_body`.
 */
export function validateLoopBackEdgeBody(graph: ExecutableGraph, loopBackEdgeIds: ReadonlySet<string>): Outcome<void> {
  for (const node of graph.nodesById.values()) {
    if (node.type !== 'loop') {
      continue;
    }
    const body = computeLoopBodyNodeIds(graph, node);
    const incoming = graph.incomingEdges.get(node.id) ?? [];

    for (const edge of incoming) {
      if (loopBackEdgeIds.has(edge.id) && !body.has(edge.sourceNodeId)) {
        return {
          kind: 'error',
          message: formatEngineErrorMessage(
            'loop_back_edge_outside_body',
            `A(z) ${node.id} loop node ${edge.id} visszaélének forrása (${edge.sourceNodeId}) nincs a ciklus törzsében`,
          ),
        };
      }
    }
  }

  return { kind: 'ok', value: undefined };
}
