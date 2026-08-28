import { describe, expect, it } from 'vitest';
import { createSchedulerState } from './create-scheduler-state.ts';

describe('createSchedulerState', () => {
  it('minden nyilvántartása üres, és nulláról indul az érkezési sorszám', () => {
    expect(createSchedulerState()).toStrictEqual({
      edgeMarks: new Map(),
      fanOutExpansions: new Map(),
      fanOutItems: new Map(),
      loopScopeOwners: new Map(),
      loopRunCounts: new Map(),
      readyInstances: [],
      runningInstanceKeys: new Set(),
      nextArrivalSequence: 0,
    });
  });

  it('két hívás két független állapotot ad', () => {
    const first = createSchedulerState();
    const second = createSchedulerState();

    expect(first.edgeMarks).not.toBe(second.edgeMarks);
  });
});
