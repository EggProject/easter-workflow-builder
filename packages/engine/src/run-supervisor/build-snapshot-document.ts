import type {
  GraphSnapshotDocument,
  SnapshotEdge,
  SnapshotNode,
  WorkflowGraph,
  WorkflowRecord,
} from '@easter-workflow-builder/db';
import { GRAPH_DOCUMENT_VERSION } from '@easter-workflow-builder/db';
import type { ProviderId } from '@easter-workflow-builder/provider-capability';

/**
 * A pillanatkép dokumentum összeállításának bemenete (SPEC-004 4.8 5. lépés,
 * SPEC-003 5.1).
 *
 * - `workflow`, `graph`: a `readGraph` és a `getWorkflow` eredménye, az élő
 *   szerkesztői állapot (4.8 1. lépés).
 * - `sdkVersionPin`: a **telepített** Agent SDK verziója a futás indításakor
 *   (SPEC-003 5.1: "visszanézéskor ez mondja meg, milyen kliensverzió alatt
 *   futott a workflow").
 * - `providerByNodeId`: a node-onként feloldott provider (11.1), ami a
 *   dokumentumba **befagy**.
 * - `fallbackProviderId`: annak a node-nak a providere, amihez a térképben
 *   nincs bejegyzés. Lásd a függvény doksijának "Miért van visszaesés"
 *   szakaszát.
 */
export interface BuildSnapshotDocumentInput {
  readonly workflow: WorkflowRecord;
  readonly graph: WorkflowGraph;
  readonly sdkVersionPin: string;
  readonly providerByNodeId: ReadonlyMap<string, ProviderId>;
  readonly fallbackProviderId: ProviderId;
}

/**
 * A workflow élő gráfjából pillanatkép dokumentum (SPEC-004 4.8 5. lépés). Az
 * átalakítás mezőnkénti másolás: a dokumentum a node configot **változatlanul**
 * viszi át (a `SnapshotNode.config` szándékosan `unknown`, SPEC-003 5.1), és
 * egyetlen futásonként változó mezőt sem vesz fel (SPEC-003 54. kritérium),
 * mert a tartalom szerinti címzés ezen áll.
 *
 * **Miért van visszaesés a providerre, és miért hívjuk a függvényt kétszer.**
 * A 4.8 menet sorrendje kötött: a gráf validáció (3. lépés) a **pillanatkép
 * dokumentumot** kapja bemenetként (`validateRun`), a node-onkénti provider
 * feloldás viszont ugyanannak a validációnak a mellékterméke - a dokumentum
 * tehát előbb kell, mint a végleges provider térkép. A `validateRun` a
 * dokumentum `effectiveProviderId` mezőjét **nem olvassa** (a saját doksija
 * mondja ki), ezért a `run-supervisor` először egy ideiglenes dokumentumot
 * épít, amiben minden node a futás szintű providert (workflow felülírás vagy
 * globális alapértelmezés) kapja, majd a validáció után újra hívja ezt a
 * függvényt a valódi térképpel. **Az ideiglenes dokumentum sosem kerül
 * adatbázisba**; a `startRun` a másodikat kapja.
 */
export function buildSnapshotDocument(input: BuildSnapshotDocumentInput): GraphSnapshotDocument {
  const nodes: SnapshotNode[] = input.graph.nodes.map((node) => ({
    id: node.id,
    type: node.type,
    label: node.label,
    position: { x: node.positionX, y: node.positionY },
    config: node.config,
    effectiveProviderId: input.providerByNodeId.get(node.id) ?? input.fallbackProviderId,
  }));

  const edges: SnapshotEdge[] = input.graph.edges.map((edge) => ({
    id: edge.id,
    sourceNodeId: edge.sourceNodeId,
    targetNodeId: edge.targetNodeId,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    branchKey: edge.branchKey,
  }));

  return {
    version: GRAPH_DOCUMENT_VERSION,
    sdkVersionPin: input.sdkVersionPin,
    workflow: { id: input.workflow.id, name: input.workflow.name, description: input.workflow.description },
    nodes,
    edges,
  };
}
