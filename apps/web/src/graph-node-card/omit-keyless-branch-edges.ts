import type { WorkflowEdgeInput, WorkflowNodeInput } from '@easter-workflow-builder/protocol';

/**
 * A régi, kulcs nélküli elágazás élek elhagyása (SPEC-008 5.1, O-27): a
 * `branch` kártyáról a kulcs nélküli kimenet megszűnt (O-23), a React Flow
 * pedig a `null` handle azonosítójú élt az első handle-hez köti (M-111), tehát
 * egy ilyen él az első ág kimenetéből indulva, félrevezetően rajzolódna. A motor
 * ezt az élt soha nem követi (SPEC-008 6.6 3. pont), így a rajzról nem tűnik el olyan út, amin
 * a futás ténylegesen haladt.
 *
 * Pontosan az az él marad ki, aminek a forrás csomópontja `branch` típusú, és a
 * `branchKey` mezője `null`. Más típus kulcs nélküli kimenetének éle (az
 * `agent_step` névtelen kimenete, az `error_handler` névtelen kimenete) és a
 * kulcsos él megmarad. A típust a csomópont `type` mezője adja, mert a kártya
 * kimenő handle-jeinek készletét is ez választja ki (`GRAPH_NODE_CATALOG`); a
 * listában nem szereplő forrás csomópont éle szintén megmarad.
 *
 * Tiszta függvény, DOM és `@xyflow/react` hivatkozás nélkül: a futás nézet a
 * vászon élleképezése előtt hívja (`RunGraphCanvas`), a szerkesztő a betöltés
 * normalizálásában (PLAN-009 T-009-55).
 */
export function omitKeylessBranchEdges(
  nodes: readonly WorkflowNodeInput[],
  edges: readonly WorkflowEdgeInput[],
): WorkflowEdgeInput[] {
  const branchNodeIds = new Set(nodes.filter((node) => node.type === 'branch').map((node) => node.id));
  return edges.filter((edge) => edge.branchKey !== null || !branchNodeIds.has(edge.sourceNodeId));
}
