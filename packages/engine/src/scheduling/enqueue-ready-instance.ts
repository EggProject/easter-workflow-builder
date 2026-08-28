import type { StepInstanceReference } from '../run-context/step-instance-reference.ts';
import type { SchedulerState } from './scheduler-state.ts';

/**
 * Egy node példány felvétele az érkezési sorba, a következő monoton növekvő
 * sorszámmal (SPEC-004 7.1).
 *
 * **Miért kell a jelöléseken kívüli belépési pont.** Az `advanceScheduler`
 * kizárólag élenkénti jelölésekből következtet futtathatóságra (4.4 2. pont),
 * és két olyan példány van, ami nem így válik futtathatóvá:
 *
 * - a `start` node egyetlen példánya a futás indulásakor (4.4 1. pont),
 *   amihez az `enqueueStartInstance` áll, és ami ezt a függvényt hívja;
 * - a **megismételt** node példány egy sikeres `error_handler` lefutás után
 *   (8.2 4. és 5. pont, `run-supervisor` téma, T-005-25). A megismételt
 *   példány bejövő élein a jelölés változatlanul `live` áll, tehát nem a
 *   jelölés kiírása, hanem a kezelő döntése teszi újra futtathatóvá.
 *
 * A `takeNextReadyInstance` ezután ugyanúgy viszi tovább, mint bármely más
 * példányt: felveszi a futók halmazába, tehát a futás terminális állapota
 * (4.4 6. pont) helyesen marad hamis, amíg a megismételt lépés fut.
 */
export function enqueueReadyInstance(state: SchedulerState, instance: StepInstanceReference): SchedulerState {
  return {
    ...state,
    readyInstances: [...state.readyInstances, { instance, arrivalSequence: state.nextArrivalSequence }],
    nextArrivalSequence: state.nextArrivalSequence + 1,
  };
}
