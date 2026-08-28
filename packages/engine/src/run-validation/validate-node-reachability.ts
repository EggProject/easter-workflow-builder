import type { Outcome } from '@easter-workflow-builder/core';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';
import { computeReachableNodeIds } from '../run-graph/compute-reachable-node-ids.ts';
import type { ExecutableGraph } from '../run-graph/executable-graph.ts';

/**
 * A SPEC-004 4.7 táblázat 3. sora: "minden node elérhető a `start` node-ból",
 * különben `unreachable_node`.
 *
 * A bejárást a `run-graph` téma `computeReachableNodeIds` függvénye végzi (a
 * teljes élhalmazon, a visszaéleket is követve), itt csak a hibaág áll: a
 * halmazból hiányzó node azonosító a hiba.
 */
export function validateNodeReachability(graph: ExecutableGraph, startNodeId: string): Outcome<void> {
  const reachable = computeReachableNodeIds(graph, startNodeId);

  for (const nodeId of graph.nodesById.keys()) {
    if (!reachable.has(nodeId)) {
      return {
        kind: 'error',
        message: formatEngineErrorMessage(
          'unreachable_node',
          `A(z) ${nodeId} node nem érhető el a(z) ${startNodeId} start node-ból`,
        ),
      };
    }
  }

  return { kind: 'ok', value: undefined };
}
