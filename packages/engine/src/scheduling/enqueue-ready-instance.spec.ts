import { describe, expect, it } from 'vitest';
import type { BranchScope } from '../branch-scope/branch-scope.ts';
import { createSchedulerState } from './create-scheduler-state.ts';
import { enqueueReadyInstance } from './enqueue-ready-instance.ts';

const fanOutScope: BranchScope = { kind: 'fan_out', stepRunId: 'sr-1', itemIndex: 2 };

describe('enqueueReadyInstance', () => {
  it('a sor végére teszi a példányt, a következő érkezési sorszámmal', () => {
    const state = enqueueReadyInstance(createSchedulerState(), { nodeId: 'a', branchContext: [] });

    expect(state.readyInstances).toStrictEqual([{ instance: { nodeId: 'a', branchContext: [] }, arrivalSequence: 0 }]);
    expect(state.nextArrivalSequence).toBe(1);
  });

  it('az ág kontextust változatlanul viszi, tehát fan-out ág eleme is újra sorba állítható', () => {
    const first = enqueueReadyInstance(createSchedulerState(), { nodeId: 'a', branchContext: [] });
    const second = enqueueReadyInstance(first, { nodeId: 'b', branchContext: [fanOutScope] });

    expect(second.readyInstances).toHaveLength(2);
    expect(second.readyInstances[1]).toStrictEqual({
      instance: { nodeId: 'b', branchContext: [fanOutScope] },
      arrivalSequence: 1,
    });
    expect(second.nextArrivalSequence).toBe(2);
  });

  it('a kapott állapotot érintetlenül hagyja', () => {
    const state = createSchedulerState();

    enqueueReadyInstance(state, { nodeId: 'a', branchContext: [] });

    expect(state.readyInstances).toStrictEqual([]);
    expect(state.nextArrivalSequence).toBe(0);
  });
});
