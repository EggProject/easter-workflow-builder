import type { SnapshotEdge, SnapshotNode } from '@easter-workflow-builder/db';

/**
 * A pillanatképből felépített, indexelt gráf alak, amin az ütemező és a gráf
 * validációk dolgoznak (SPEC-004 4.1): a `nodesById` a node index azonosító
 * szerint, az `outgoingEdges` és az `incomingEdges` a node-onkénti kimenő és
 * bejövő él lista, mindkettő a pillanatkép szerinti sorrendben.
 *
 * Az `ExecutableGraph` a nyers `GraphSnapshotDocument` node és él listájának
 * átindexelése, semmi több: nem szűr, nem ellenőriz és nem hagy el adatot.
 *
 * **A `dangling_edge` ellenőrzés nem itt dől el** (SPEC-004 4.7): ha egy él
 * forrása vagy célja nem létező node, az él attól még bekerül az él
 * térképekbe, csak a `nodesById` nem talál hozzá node-ot. Az ellenőrzés a
 * `run-validation` téma dolga (PLAN-005 T-005-15).
 */
export interface ExecutableGraph {
  readonly nodesById: ReadonlyMap<string, SnapshotNode>;
  readonly outgoingEdges: ReadonlyMap<string, readonly SnapshotEdge[]>;
  readonly incomingEdges: ReadonlyMap<string, readonly SnapshotEdge[]>;
}
