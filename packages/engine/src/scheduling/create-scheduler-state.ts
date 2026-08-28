import type { SchedulerState } from './scheduler-state.ts';

/**
 * Az ütemező kiinduló állapota: minden nyilvántartás üres, és az első
 * kiosztandó érkezési sorszám a nulla.
 *
 * A `start` node példánya **nem** ebben az állapotban áll: azt az
 * `enqueueStartInstance` teszi a sorba, mert a SPEC-004 4.4 1. pontja szerint
 * a jelölés a futás indulásakor keletkezik, nem az ütemező létrehozásakor.
 */
export function createSchedulerState(): SchedulerState {
  return {
    edgeMarks: new Map(),
    fanOutExpansions: new Map(),
    fanOutItems: new Map(),
    loopScopeOwners: new Map(),
    loopRunCounts: new Map(),
    readyInstances: [],
    runningInstanceKeys: new Set(),
    nextArrivalSequence: 0,
  };
}
