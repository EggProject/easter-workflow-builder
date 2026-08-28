import type { Outcome } from '@easter-workflow-builder/core';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';
import type { ExecutableGraph } from './executable-graph.ts';

/**
 * Kör keresés a gráfon, a `loopBackEdgeIds` halmazban álló visszaélek
 * elhagyása után (SPEC-004 4.6, a validációs sorrend 2. lépése).
 *
 * Ez az a pont, ahol egy `loop` node nélkül rajzolt kör elbukik: visszaélnek
 * csak `loop` node-ra mutató él minősül (`findLoopBackEdges`), tehát bármilyen
 * más kör érintetlenül megmarad, és `graph_cycle_detected` hibát ad. A
 * hibaüzenet megnevezi a körben álló node azonosítókat.
 *
 * Az algoritmus mélységi bejárás három színnel: az `onPath` halmaz a szürke
 * (az aktuális úton álló), a `finished` halmaz a fekete (befejezett) node-ok,
 * a fehér az egyikben sem szereplő. Szürke node-ra mutató él kört zár, és a
 * `path` verem adja a kört alkotó azonosítókat. Több kör esetén az elsőként
 * megtaláltat jelenti: a spec nem ír elő "minden kört" követelményt.
 */
export function detectGraphCycle(graph: ExecutableGraph, loopBackEdgeIds: ReadonlySet<string>): Outcome<void> {
  const finished = new Set<string>();
  const onPath = new Set<string>();
  const path: string[] = [];

  function visit(nodeId: string): readonly string[] | undefined {
    onPath.add(nodeId);
    path.push(nodeId);

    const outgoing = graph.outgoingEdges.get(nodeId) ?? [];
    for (const edge of outgoing) {
      if (loopBackEdgeIds.has(edge.id)) {
        continue;
      }
      if (onPath.has(edge.targetNodeId)) {
        return path.slice(path.indexOf(edge.targetNodeId));
      }
      if (finished.has(edge.targetNodeId)) {
        continue;
      }
      const cycle = visit(edge.targetNodeId);
      if (cycle !== undefined) {
        return cycle;
      }
    }

    path.pop();
    onPath.delete(nodeId);
    finished.add(nodeId);
    return undefined;
  }

  for (const nodeId of graph.nodesById.keys()) {
    if (finished.has(nodeId)) {
      continue;
    }
    const cycle = visit(nodeId);
    if (cycle !== undefined) {
      return {
        kind: 'error',
        message: formatEngineErrorMessage(
          'graph_cycle_detected',
          `A gráf kört tartalmaz a következő node-okon át: ${cycle.join(', ')}`,
        ),
      };
    }
  }

  return { kind: 'ok', value: undefined };
}
