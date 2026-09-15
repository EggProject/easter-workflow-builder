import type { ReactElement } from 'react';
import { GRAPH_NODE_CARD_HEIGHT, GRAPH_NODE_CARD_WIDTH } from '../graph-node-catalog/graph-node-catalog.ts';

/**
 * A `graph-node-catalog` téma egyetlen mért kártya méret konstansát
 * (T-009-19, SPEC-008 5.7, AC62) egy `:root` custom property párra fordítja;
 * a `graph-node-card.css` ezt olvassa `min-width`/`min-height`-ként.
 *
 * **Miért önálló komponens.** Ez az EGYETLEN hely, ahol a két szám a CSS felé
 * eljut, és két vászon fogyasztja: a szerkesztő (`graph-editor`) és a futás
 * nézet csak olvasható vászna (`run-graph`, T-009-20). A dagre hívás
 * (`graph-auto-layout` téma) ugyanezt a konstanst importálja közvetlenül,
 * szám duplikáció nélkül.
 */
export function GraphNodeCardSizeStyle(): ReactElement {
  return (
    <style>{`:root { --graph-node-card-width: ${String(GRAPH_NODE_CARD_WIDTH)}px; --graph-node-card-height: ${String(GRAPH_NODE_CARD_HEIGHT)}px; }`}</style>
  );
}
