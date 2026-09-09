import type { WorkflowEdgeInput, WorkflowGraphDocument, WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import { workflowEdgeToEdgeInput, workflowNodeToNodeInput } from './graph-editor-document-projection.ts';

/**
 * A mentetlen jelző: a betöltött dokumentum (`baseline`, a `GET`
 * válaszából) és a szerkesztő jelenlegi állapota (`GraphEditorCanvas`
 * `onGraphChange`-éből) tartalmi összehasonlításából adódik (SPEC-008 5.5,
 * T-009-17, AC13). A `JSON.stringify` alapú összehasonlítás ehhez elég: mind
 * a két oldal ugyanazon a leképezési láncon megy át (`workflowNodeToNodeInput`
 * / `workflowEdgeToEdgeInput`, illetve a `graph-editor-node-mapping` /
 * `graph-editor-edge-mapping` függvényei), tehát a mezők sorrendje mindkét
 * oldalon azonos - ez eltér a `packages/db` pillanatkép hash-elésétől, ahol a
 * bejövő adat sorrendje nem garantált, ezért ott RFC 8785 kanonizálás kell
 * (`.claude/CLAUDE.md` 12. szekció).
 */
export function isGraphDirty(
  baseline: Pick<WorkflowGraphDocument, 'nodes' | 'edges'> | undefined,
  currentNodes: readonly WorkflowNodeInput[],
  currentEdges: readonly WorkflowEdgeInput[],
): boolean {
  if (baseline === undefined) {
    return false;
  }
  const baselineNodes = baseline.nodes.map((node) => workflowNodeToNodeInput(node));
  const baselineEdges = baseline.edges.map((edge) => workflowEdgeToEdgeInput(edge));
  return (
    JSON.stringify(baselineNodes) !== JSON.stringify(currentNodes) ||
    JSON.stringify(baselineEdges) !== JSON.stringify(currentEdges)
  );
}
