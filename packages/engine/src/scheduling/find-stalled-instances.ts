import type { StepInstanceReference } from '../run-context/step-instance-reference.ts';
import { resolveInstanceReadiness } from './resolve-instance-readiness.ts';
import type { RunTopology } from './run-topology.ts';
import type { SchedulerState } from './scheduler-state.ts';

/**
 * Az elakadt példányok egy terminális ütemező állapotban (SPEC-004 4.9): azok a
 * jelölést kapott példányok (`markedInstances`), amelyek futtathatósága a
 * `resolveInstanceReadiness` szerint `waiting`, azaz legalább egy bejövő
 * jelölésük hiányzik. Terminális állapotban ez a hiányzó jelölés már soha nem
 * érkezik meg. A jelölés fajtája nem számít: a fel nem használt `live` jelölés
 * és a csak `dead` jelölésekkel várakozó példány ugyanaz az állapot.
 *
 * Tiszta függvény, az ütemező állapotát nem módosítja. Hogy MIKOR kell
 * hívni (kezeletlen hiba nélkül, nem leállított futás terminális pontján), az a
 * `run-supervisor` döntése; a sorrend a nyilvántartás beszúrási sorrendje.
 */
export function findStalledInstances(state: SchedulerState, topology: RunTopology): readonly StepInstanceReference[] {
  return state.markedInstances
    .values()
    .filter((instance) => resolveInstanceReadiness(state, topology, instance) === 'waiting')
    .toArray();
}
