import type { Outcome } from '@easter-workflow-builder/core';
import type { SnapshotEdge, SnapshotNode } from '@easter-workflow-builder/db';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';
import { computeReachableAvoiding } from './compute-reachable-avoiding.ts';
import type { ExecutableGraph } from './executable-graph.ts';

// A `loop` node törzsének node azonosítói: a `continue` `branchKey` értékű
// kimenő élek célpontjaiból indulva, bármilyen `branchKey` mentén, de a `loop`
// node újbóli érintése NÉLKÜL. A `loop` node-on át a bejárás a saját `exit`
// ágára is kijutna, és az ott álló, a `loop`-ra visszamutató node a törzsbe
// számítana (a PR #55 review rése, research 2026-10-21 8. szekció). Egy
// beágyazott belső `loop` node-on át a bejárás továbbhalad, tehát a külső
// törzs a belső `loop` `exit` ágát is tartalmazza.
function computeLoopBodyNodeIds(graph: ExecutableGraph, loopNode: SnapshotNode): ReadonlySet<string> {
  const body = new Set<string>();
  const outgoing = graph.outgoingEdges.get(loopNode.id) ?? [];

  for (const edge of outgoing) {
    if (edge.branchKey !== 'continue' || edge.targetNodeId === loopNode.id) {
      continue;
    }
    for (const bodyNodeId of computeReachableAvoiding(graph, edge.targetNodeId, loopNode.id)) {
      body.add(bodyNodeId);
    }
  }

  return body;
}

// A visszaél forrása a törzsben áll, vagy maga a `loop` node egy önmagára
// mutató `continue` élen (ez újabb lefutást indít, `advance-scheduler.spec.ts`).
// A `loop` önmagára mutató `exit` éle nem a `continue` éleken át érkezik.
function isFromLoopBody(edge: SnapshotEdge, loopNode: SnapshotNode, body: ReadonlySet<string>): boolean {
  return body.has(edge.sourceNodeId) || (edge.sourceNodeId === loopNode.id && edge.branchKey === 'continue');
}

/**
 * A visszaél törzsön belüliségének ellenőrzése (SPEC-004 4.6, a validációs
 * sorrend 3. lépése): "Minden visszaél forrásának a `loop` node törzsében kell
 * lennie, azaz elérhetőnek a `loop` node `continue` élein át." Ha nem, a hiba
 * `loop_back_edge_outside_body`. Ez fogja meg azt a gráfot is, amelynek a
 * `loop` `exit` ága nulla, egy vagy több node-on át ugyanabba a `loop`-ba tér
 * vissza: a visszatérő él forrását a `loop` dominálja, tehát az él visszaél,
 * a forrása viszont nem a törzsben áll.
 */
export function validateLoopBackEdgeBody(graph: ExecutableGraph, loopBackEdgeIds: ReadonlySet<string>): Outcome<void> {
  for (const node of graph.nodesById.values()) {
    if (node.type !== 'loop') {
      continue;
    }
    const body = computeLoopBodyNodeIds(graph, node);
    const incoming = graph.incomingEdges.get(node.id) ?? [];

    for (const edge of incoming) {
      if (loopBackEdgeIds.has(edge.id) && !isFromLoopBody(edge, node, body)) {
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
