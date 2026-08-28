import type { Outcome } from '@easter-workflow-builder/core';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';
import type { ExecutableGraph } from '../run-graph/executable-graph.ts';

/**
 * A SPEC-004 4.7 táblázat 1. sora: "pontosan egy `start` típusú node van",
 * különben `invalid_start_node`.
 *
 * A sikeres ág magát az azonosítót adja vissza, mert a rákövetkező
 * ellenőrzések (`validateNodeReachability`, `validateScopeBalance`) és a futás
 * első jelölése (SPEC-004 4.4 1. pont) mind ebből a node-ból indulnak. Ez
 * ezért a validációs sorrend első lépése: nélküle nincs miből bejárni a
 * gráfot.
 */
export function validateStartNode(graph: ExecutableGraph): Outcome<string> {
  const startNodeIds: string[] = [];
  for (const node of graph.nodesById.values()) {
    if (node.type === 'start') {
      startNodeIds.push(node.id);
    }
  }
  const [startNodeId, ...furtherStartNodes] = startNodeIds;

  if (startNodeId === undefined || furtherStartNodes.length > 0) {
    return {
      kind: 'error',
      message: formatEngineErrorMessage(
        'invalid_start_node',
        `A gráfban pontosan egy start típusú node kell álljon, ${startNodeIds.length.toString()} darab áll benne`,
      ),
    };
  }

  return { kind: 'ok', value: startNodeId };
}
