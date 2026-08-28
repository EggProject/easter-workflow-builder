import type { FanOutJoinPairing } from '../branch-scope/fan-out-join-pairing.ts';
import type { ExecutableGraph } from '../run-graph/executable-graph.ts';

/**
 * A futás **változatlan** topológiája, amiből az ütemező dolgozik: a gráf, a
 * visszaél halmaz és a fan-out/join párosítás. Mindhárom a futás indítási
 * validáció eredménye, és a futás alatt egyetlen mezője sem változik
 * (SPEC-004 4.1: az ütemező a pillanatképről dolgozik, nem az élő gráfról).
 *
 * **Miért nem a `ValidatedRun` áll a szignatúrákban.** A `ValidatedRun` ezt a
 * három mezőt is hordozza, tehát **szerkezetileg illeszkedik** erre a típusra,
 * és a hívó a saját `ValidatedRun` értékét átadhatja átalakítás nélkül. A
 * szűkebb alak viszont kimondja, mire van az ütemezőnek ténylegesen szüksége:
 * a node configokat és a feloldott providereket nem olvassa, azok a végrehajtó
 * réteg bemenetei.
 */
export interface RunTopology {
  readonly graph: ExecutableGraph;
  readonly loopBackEdgeIds: ReadonlySet<string>;
  readonly fanOutJoinPairing: FanOutJoinPairing;
}
