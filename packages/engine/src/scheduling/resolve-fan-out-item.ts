import type { BranchContext } from '../branch-scope/branch-scope.ts';
import type { SchedulerState } from './scheduler-state.ts';

/**
 * A legbelső `fan_out` hatókör elemének **értéke** egy ág kontextusban, vagyis
 * a `RunContext.item` mező forrása (SPEC-004 6.1). Ez az érték a
 * `buildRunContext` `item` bemenete (T-005-16), és a `fan_out` végrehajtója
 * ezen a függvényen keresztül jut hozzá.
 *
 * **Miért nem a veremből jön.** A `BranchScope` `fan_out` kerete a 4.3 szekció
 * szerint kizárólag a `stepRunId` és az `itemIndex` mezőt hordozza, az elem
 * értékét nem; azt a `fan_out` kibontáskor az ütemező írja a
 * `fanOutItems` térképbe, a kibontó lépés futásának azonosítója alatt.
 *
 * A verem a gyökértől befelé áll, ezért az előre haladó bejárás **utolsó**
 * `fan_out` találata a legbelső keret; ugyanez a bejárás alakja áll a
 * `run-context` téma `innermostItemIndex` segédjében. `fan_out` keret nélküli
 * kontextusra, és ismeretlen hatókörre is `undefined` az eredmény, ami a
 * `RunContext.item` mező "nincs érték" alakja.
 */
export function resolveFanOutItem(state: SchedulerState, context: BranchContext): unknown {
  let item: unknown;

  for (const scope of context) {
    if (scope.kind === 'fan_out') {
      item = state.fanOutItems.get(scope.stepRunId)?.[scope.itemIndex];
    }
  }

  return item;
}
