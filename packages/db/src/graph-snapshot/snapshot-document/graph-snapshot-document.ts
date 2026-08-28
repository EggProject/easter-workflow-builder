import type { ProviderId } from '@easter-workflow-builder/provider-capability';
import type { NodeType } from '../../workflow-graph/node-type.ts';

/**
 * A kiadott pillanatkép dokumentum verziók szűk uniója (SPEC-003 5.2
 * szekció). Ma egyetlen kiadott verzió van. Egy jövőbeli verzió felvétele
 * (`| 2`) fordítási hibát ad mindaddig, amíg a `readGraphSnapshot` kimerítő
 * `switch` szerkezetéhez nem kerül `case 2` ág
 * (`@typescript-eslint/switch-exhaustiveness-check`), és amíg az
 * `isGraphSnapshotDocumentVersion` kulcslistája sem bővül.
 */
export type GraphSnapshotDocumentVersion = 1;

/**
 * A ma írt dokumentumok verziószáma (SPEC-003 16. kritérium). Ezt hordozza a
 * dokumentum `version` mezője és a `graph_snapshot.document_version` oszlop.
 */
export const GRAPH_DOCUMENT_VERSION = 1 satisfies GraphSnapshotDocumentVersion;

/**
 * A gráf szerkesztő koordinátája, a `workflow_node.position_x`/`position_y`
 * oszlopból (SPEC-003 4.2).
 */
export interface SnapshotPosition {
  readonly x: number;
  readonly y: number;
}

/**
 * Egy node befagyasztott állapota a futás indításának pillanatában
 * (SPEC-003 5.1). A `config` szándékosan `unknown`: a dokumentum a node
 * configot változatlanul másolja ki, a szűkítést a megjelenítő oldal végzi az
 * `isNodeConfig` guarddal. Az `effectiveProviderId` a háromszintű feloldás
 * (globális, workflow, lépés) befagyasztott eredménye.
 */
export interface SnapshotNode {
  readonly id: string;
  readonly type: NodeType;
  readonly label: string;
  readonly position: SnapshotPosition;
  readonly config: unknown;
  readonly effectiveProviderId: ProviderId;
}

/**
 * Egy él befagyasztott állapota (SPEC-003 5.1). A nullable mezők a
 * `workflow_edge` tábla nullable oszlopait tükrözik (SPEC-003 4.7).
 */
export interface SnapshotEdge {
  readonly id: string;
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly sourceHandle: string | null;
  readonly targetHandle: string | null;
  readonly branchKey: string | null;
}

/**
 * A workflow fejléce a pillanatképben (SPEC-003 5.1). A `description` a
 * `workflow.description` nullable oszlopából jön (SPEC-003 4.1).
 */
export interface SnapshotWorkflow {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
}

/**
 * Az 1. verziójú pillanatkép dokumentum (SPEC-003 5.1).
 *
 * **Nincs benne futásonként változó mező** (SPEC-003 54. kritérium): nincs
 * `capturedAtMs`, nincs futás azonosító, és nincs benne a delta kapcsoló
 * állása. Ez a tartalom szerinti címzés előfeltétele: egyetlen futásonként
 * egyedi mező elég lenne ahhoz, hogy minden dokumentum különbözzön, és a
 * megosztás soha ne történjen meg. A rögzítés ideje a
 * `graph_snapshot.first_captured_at_ms` oszlopban áll.
 *
 * Az `sdkVersionPin` a telepített Agent SDK verziója a futás indításakor: a
 * kimenő kérés mezőlistája SDK verzióhoz kötött, visszanézéskor ez mondja
 * meg, milyen kliensverzió alatt futott a workflow.
 */
export interface GraphSnapshotDocumentV1 {
  readonly version: 1;
  readonly sdkVersionPin: string;
  readonly workflow: SnapshotWorkflow;
  readonly nodes: readonly SnapshotNode[];
  readonly edges: readonly SnapshotEdge[];
}

/**
 * A megjelenítendő dokumentum alakja, tehát az, amit a `readGraphSnapshot` a
 * hívónak ad. Ma egyetlen kiadott verzió van, ezért az unió egyetlen tagú; egy
 * jövőbeli verziónál a régi dokumentumokat az átalakító lánc emeli erre az
 * alakra (SPEC-003 5.3, 4. lépés).
 */
export type GraphSnapshotDocument = GraphSnapshotDocumentV1;
