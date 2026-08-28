import { describe, expect, it } from 'vitest';
import { createSchedulerState } from './create-scheduler-state.ts';
import { enqueueStartInstance } from './enqueue-start-instance.ts';

describe('enqueueStartInstance', () => {
  it('a start node példányát a gyökér kontextusban, nulla sorszámmal teszi a sorba', () => {
    const state = enqueueStartInstance(createSchedulerState(), 'start');

    expect(state.readyInstances).toStrictEqual([
      { instance: { nodeId: 'start', branchContext: [] }, arrivalSequence: 0 },
    ]);
    expect(state.nextArrivalSequence).toBe(1);
  });

  it('a kapott állapotot érintetlenül hagyja', () => {
    const initial = createSchedulerState();

    enqueueStartInstance(initial, 'start');

    expect(initial.readyInstances).toStrictEqual([]);
    expect(initial.nextArrivalSequence).toBe(0);
  });
});
