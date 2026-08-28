import type { Outcome } from '@easter-workflow-builder/core';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';
import type { ExecutableGraph } from '../run-graph/executable-graph.ts';

/**
 * A SPEC-004 4.7 táblázat 2. sora: "minden él forrása és célja létező node a
 * pillanatképben", különben `dangling_edge`.
 *
 * Az `ExecutableGraph` szándékosan nem szűr (lásd az `executable-graph.ts`
 * dokumentációját): a nem létező node-ra mutató él bekerül az él térképekbe,
 * csak a `nodesById` nem talál hozzá node-ot. Az ellenőrzés ezért itt áll, és
 * a validációs sorrendben korán: minden későbbi bejárás abból indul ki, hogy
 * az élek valódi node-okat kötnek össze.
 *
 * Az `outgoingEdges` térkép minden élt pontosan egyszer tartalmaz (a forrása
 * alatt), ezért elég ezen végigmenni; az `incomingEdges` ugyanazt az élhalmazt
 * indexeli a cél felől.
 */
export function validateEdgeEndpoints(graph: ExecutableGraph): Outcome<void> {
  for (const edges of graph.outgoingEdges.values()) {
    for (const edge of edges) {
      if (!graph.nodesById.has(edge.sourceNodeId)) {
        return {
          kind: 'error',
          message: formatEngineErrorMessage(
            'dangling_edge',
            `A(z) ${edge.id} él forrása (${edge.sourceNodeId}) nem létező node a pillanatképben`,
          ),
        };
      }
      if (!graph.nodesById.has(edge.targetNodeId)) {
        return {
          kind: 'error',
          message: formatEngineErrorMessage(
            'dangling_edge',
            `A(z) ${edge.id} él célja (${edge.targetNodeId}) nem létező node a pillanatképben`,
          ),
        };
      }
    }
  }

  return { kind: 'ok', value: undefined };
}
