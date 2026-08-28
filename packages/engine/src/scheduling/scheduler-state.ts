import type { EdgeMark } from './edge-mark.ts';
import type { FanOutExpansion } from './fan-out-expansion.ts';
import type { ReadyInstance } from './ready-instance.ts';

/**
 * A DAG ütemező teljes, **memóriában élő** állapota (SPEC-004 4.4 ... 4.6).
 * Adatbázist nem érint, portot nem hív: minden reducer tiszta függvény, ami
 * egy új állapotot ad vissza, a kapottat érintetlenül hagyva.
 *
 * A négy térkép kulcsát a `buildScopedKey` állítja elő, mert a nyilvántartás
 * egysége mindenhol az `(azonosító, ág kontextus)` pár (4.3), amit sem az
 * élazonosító, sem a node azonosító önmagában nem határoz meg.
 *
 * - `edgeMarks`: `(élazonosító, ág kontextus)` -> jelölés. A kontextus az
 *   **élen** álló verem, tehát a cél példány kontextusa; `join` node bejövő
 *   élén a belső, `fan_out` kerettel bővült verem (4.5).
 * - `fanOutExpansions`: `(fan_out node, külső ág kontextus)` -> a kibontás
 *   eredménye. Ebből tudja a `join`, hány jelölésre vár, és ebből derül ki a
 *   `N = 0` eset és a halott `fan_out` példány is.
 * - `fanOutItems`: a `fan_out` lépés futásának azonosítója -> az elem lista.
 *   A `BranchScope` `fan_out` kerete csak a `stepRunId` és az `itemIndex`
 *   mezőt hordozza, ezért az elem **értékéhez** ez a térkép kell
 *   (`resolveFanOutItem`).
 * - `loopScopeOwners`: a `loop` hatókört nyitó lépés futásának azonosítója ->
 *   a nyitó `loop` node azonosítója. A visszaélen érkező jelölés kontextusát
 *   ebből lehet a `loop` node saját kontextusára visszavágni, egymásba
 *   ágyazott ciklusok mellett is.
 * - `loopRunCounts`: `(loop node, ág kontextus)` -> a példány addigi
 *   lefutásainak száma, ami egyben a következő lefutás `iteration` értéke
 *   (4.6 1. pont).
 * - `readyInstances`: a futtathatóvá vált, még el nem indított példányok,
 *   szigorúan érkezési sorrendben (7.1).
 * - `runningInstanceKeys`: az elindított, még nem zárt példányok kulcsai. A
 *   futás terminális állapotának feltétele, hogy ez és a `readyInstances` is
 *   üres legyen (4.4 6. pont).
 * - `nextArrivalSequence`: a következő kiosztandó érkezési sorszám.
 */
export interface SchedulerState {
  readonly edgeMarks: ReadonlyMap<string, EdgeMark>;
  readonly fanOutExpansions: ReadonlyMap<string, FanOutExpansion>;
  readonly fanOutItems: ReadonlyMap<string, readonly unknown[]>;
  readonly loopScopeOwners: ReadonlyMap<string, string>;
  readonly loopRunCounts: ReadonlyMap<string, number>;
  readonly readyInstances: readonly ReadyInstance[];
  readonly runningInstanceKeys: ReadonlySet<string>;
  readonly nextArrivalSequence: number;
}
