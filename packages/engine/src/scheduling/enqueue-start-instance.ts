import type { StepInstanceReference } from '../run-context/step-instance-reference.ts';
import type { SchedulerState } from './scheduler-state.ts';

/**
 * A `start` node egyetlen példányának ütemezése a gyökér kontextusban
 * (SPEC-004 4.4 1. pont): "A futás indulásakor a `start` node egyetlen
 * példánya `live` jelölést kap a gyökér kontextusban."
 *
 * **Miért külön belépési pont, és nem a jelölésekből következik.** A 4.4
 * 2. pontja bejövő élekhez tartozó jelölésekről szól, a `start` node-nak
 * viszont nincs bejövő éle (különben nem lenne az egyetlen belépési pont), így
 * a szabály rá nem alkalmazható. A `resolveInstanceReadiness` ezért bejövő él
 * nélküli példányra `waiting` állapotot ad, és a sorba kerülés kizárólag ezen
 * a függvényen át történik.
 */
export function enqueueStartInstance(state: SchedulerState, startNodeId: string): SchedulerState {
  const instance: StepInstanceReference = { nodeId: startNodeId, branchContext: [] };

  return {
    ...state,
    readyInstances: [...state.readyInstances, { instance, arrivalSequence: state.nextArrivalSequence }],
    nextArrivalSequence: state.nextArrivalSequence + 1,
  };
}
