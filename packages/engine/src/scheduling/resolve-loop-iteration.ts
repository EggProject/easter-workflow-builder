import type { StepInstanceReference } from '../run-context/step-instance-reference.ts';
import { buildScopedKey } from './build-scoped-key.ts';
import type { SchedulerState } from './scheduler-state.ts';

/**
 * A `loop` node példány következő lefutásának `iteration` értéke
 * (SPEC-004 4.6 1. pont): "Az `iteration` érték a példány addigi lefutásainak
 * a száma, nullától indulva."
 *
 * Ugyanez az érték megy a `step_run.iteration` oszlopba, a
 * `loop_iteration_started` esemény payloadjába, és ezt hasonlítja a végrehajtó
 * a config `maxIterations` mezőjéhez (4.6 2. pont). A számláló a példányhoz
 * tartozik, tehát a `(nodeId, ág kontextus)` párhoz: ugyanaz a `loop` node egy
 * fan-out ág minden elemében külön ciklust futtat, saját iterációszámmal.
 */
export function resolveLoopIteration(state: SchedulerState, instance: StepInstanceReference): number {
  return state.loopRunCounts.get(buildScopedKey(instance.nodeId, instance.branchContext)) ?? 0;
}
