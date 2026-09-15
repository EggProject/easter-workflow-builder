/* eslint-disable unicorn/no-null -- a handle azonosító a dróton ténylegesen `null` értéket hordoz, nem helyőrző `undefined`-et */
import type { Edge } from '@xyflow/react';
import { GRAPH_NODE_CATALOG } from '../graph-node-catalog/graph-node-catalog.ts';
import type { GraphNodeCardFlowNode } from '../graph-node-card/graph-node-card-data.ts';

/**
 * A `Connection` és az `Edge` közös, minimális alakja - mindkettő hordozza
 * ezt a három mezőt (M-58), tehát a függvény mindkettővel hívható a
 * `<ReactFlow isValidConnection>` prop szerződése szerint (`(edge: Edge |
 * Connection) => boolean`), duck typing-gal, `unknown` és `as` nélkül.
 */
export interface ConnectionLike {
  readonly source: string;
  readonly target: string;
  readonly sourceHandle?: string | null;
}

/**
 * Két, tisztán szerkezeti szabály a szerkesztés közbeni, azonnali
 * visszajelzéshez (SPEC-008 5.4, AC11): egyik sem gráf szemantikai szabály
 * (kör, `loop` visszaél, `fan_out` kiegyensúlyozottság - azokat a szerver
 * validálja), mindkettő a handle tábla, illetve a meglévő élek adatából
 * következik.
 *
 * 1. A cél csomópontnak nincs bemenő handle-je (`start`), tehát oda nem
 *    köthető él.
 * 2. Egy handle-ből nem indulhat két él ugyanabba a célba.
 */
export function isValidGraphConnection(
  connection: ConnectionLike,
  nodes: readonly GraphNodeCardFlowNode[],
  edges: readonly Edge[],
): boolean {
  const targetNode = nodes.find((node) => node.id === connection.target);
  if (targetNode !== undefined && !GRAPH_NODE_CATALOG[targetNode.data.workflowNode.type].hasInputHandle) {
    return false;
  }

  const sourceHandle = connection.sourceHandle ?? null;
  const isDuplicate = edges.some(
    (edge) =>
      edge.source === connection.source &&
      (edge.sourceHandle ?? null) === sourceHandle &&
      edge.target === connection.target,
  );
  return !isDuplicate;
}
