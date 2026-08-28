import type { ProviderId } from '@easter-workflow-builder/provider-capability';
import type { FanOutJoinPairing } from '../branch-scope/fan-out-join-pairing.ts';
import type { ExecutableGraph } from '../run-graph/executable-graph.ts';
import type { ExecutableNodeConfig } from './executable-node-config.ts';

/**
 * A `validateRun` sikeres ágának eredménye: minden, amit a validáció menet
 * közben már kiszámolt, és amire az ütemezőnek szüksége lesz (SPEC-004 4.8
 * 3. lépése után). A cél, hogy egyetlen számítás se ismétlődjön meg a futás
 * indítása után.
 *
 * - `graph`: a pillanatképből indexelt `ExecutableGraph` (4.1).
 * - `startNodeId`: az egyetlen `start` típusú node azonosítója, az
 *   `invalid_start_node` ellenőrzés eredménye (4.7). Innen indul a futás
 *   első, gyökér kontextusú jelölése (4.4 1. pont).
 * - `loopBackEdgeIds`: a `findLoopBackEdges` visszaél halmaza (4.6). Az
 *   ütemezőnek élenként kell tudnia, melyik bejövő él "belépő él" és melyik
 *   visszaél, mert a kettő várakozási szabálya különbözik.
 * - `fanOutJoinPairing`: a `validateScopeBalance` mellékterméke (4.5): melyik
 *   `join` node melyik `fan_out` hatókörét zárja.
 * - `nodeConfigsById`: a `malformed_node_config` és az
 *   `unimplemented_node_type` ellenőrzés **melléktermékeként** eltárolt,
 *   típusszintűen szűkített config node azonosító szerint. A validáció úgyis
 *   szűkít az `isNodeConfig` guarddal, ezért a szűkített értéket eldobni és
 *   később újra kiszámolni felesleges és hibalehetőség lenne.
 * - `effectiveProviderByNodeId`: a háromszintű provider feloldás eredménye
 *   node-onként (4.8 2. lépés, 11.1). Ez az érték fagy be a pillanatkép
 *   dokumentum `SnapshotNode.effectiveProviderId` mezőjébe a 4.8 5. lépésében.
 */
export interface ValidatedRun {
  readonly graph: ExecutableGraph;
  readonly startNodeId: string;
  readonly loopBackEdgeIds: ReadonlySet<string>;
  readonly fanOutJoinPairing: FanOutJoinPairing;
  readonly nodeConfigsById: ReadonlyMap<string, ExecutableNodeConfig>;
  readonly effectiveProviderByNodeId: ReadonlyMap<string, ProviderId>;
}
