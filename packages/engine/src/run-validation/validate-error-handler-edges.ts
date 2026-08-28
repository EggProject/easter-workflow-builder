import type { Outcome } from '@easter-workflow-builder/core';
import type { SnapshotEdge } from '@easter-workflow-builder/db';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';
import type { ExecutableGraph } from '../run-graph/executable-graph.ts';

// Egyetlen él ellenőrzése. Külön függvényben áll, mert a nem `on_error` élek
// átugrása egymásba ágyazott ciklusban `continue` lenne
// (`unicorn/no-break-in-nested-loop`).
function validateErrorHandlerEdge(graph: ExecutableGraph, edge: SnapshotEdge): Outcome<void> {
  if (edge.branchKey !== 'on_error') {
    return { kind: 'ok', value: undefined };
  }
  if (graph.nodesById.get(edge.targetNodeId)?.type !== 'error_handler') {
    return {
      kind: 'error',
      message: formatEngineErrorMessage(
        'invalid_error_handler_edge',
        `A(z) ${edge.id} on_error él célja (${edge.targetNodeId}) nem error_handler típusú node`,
      ),
    };
  }
  return { kind: 'ok', value: undefined };
}

/**
 * A SPEC-004 4.7 táblázat 7. sora: "minden `on_error` él célja `error_handler`
 * típusú node", különben `invalid_error_handler_edge`.
 *
 * Az `on_error` kulcs a 4.2 táblázat szerint bármely node kimenő élén állhat,
 * ezért az ellenőrzés a teljes élhalmazon megy, nem node típusonként. A cél
 * node létezését a `validateEdgeEndpoints` már garantálta; a `nodesById`
 * lekérdezés mégis adhat `undefined` értéket a típus szerint, ezért az
 * összehasonlítás az opcionális láncon keresztül történik.
 */
export function validateErrorHandlerEdges(graph: ExecutableGraph): Outcome<void> {
  for (const edges of graph.outgoingEdges.values()) {
    for (const edge of edges) {
      const outcome = validateErrorHandlerEdge(graph, edge);
      if (outcome.kind === 'error') {
        return outcome;
      }
    }
  }

  return { kind: 'ok', value: undefined };
}
