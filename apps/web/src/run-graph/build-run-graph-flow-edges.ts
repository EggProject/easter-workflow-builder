import type { WorkflowEdgeInput } from '@easter-workflow-builder/protocol';
import type { Edge } from '@xyflow/react';
import { workflowEdgeToFlowEdge } from '../graph-editor/graph-editor-edge-mapping.ts';

/**
 * A kiemelt él osztálya a vászon `Edge` objektumán (a `className` dokumentált
 * `Edge` mező): a `run-graph.css` ezen az osztályon festi az élt a design
 * system kiemelő színével és vastagabb vonallal (SPEC-008 6.6, "A megjelenés").
 */
export const HIGHLIGHTED_BRANCH_EDGE_CLASS_NAME = 'run-graph-edge--highlighted';

/**
 * A pillanatkép éleinek vászon alakja a futás nézetben: a szerkesztővel közös
 * leképezés, plusz a kiemelés osztálya a kiemelendő éleken (SPEC-008 6.6, 89.).
 * Tiszta függvény, mert az élek kirajzolása happy-dom alatt nem fut le (M-53),
 * az él ÁLLAPOTÁRA vonatkozó állítás ezért unit tesztben áll.
 *
 * A nem kiemelt él változatlan marad, `className` nélkül: a futás nézet élei a
 * React Flow szállított alapértelmezésén maradnak (`graph-canvas-theme.css`).
 */
export function buildRunGraphFlowEdges(
  edges: readonly WorkflowEdgeInput[],
  highlightedEdgeIds: ReadonlySet<string>,
): Edge[] {
  return edges.map((edge) => {
    const flowEdge = workflowEdgeToFlowEdge(edge);
    return highlightedEdgeIds.has(edge.id) ? { ...flowEdge, className: HIGHLIGHTED_BRANCH_EDGE_CLASS_NAME } : flowEdge;
  });
}
