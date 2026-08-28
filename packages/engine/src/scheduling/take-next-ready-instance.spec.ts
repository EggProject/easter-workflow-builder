import { describe, expect, it } from 'vitest';
import { createSchedulerState } from './create-scheduler-state.ts';
import { enqueueStartInstance } from './enqueue-start-instance.ts';
import { takeNextReadyInstance } from './take-next-ready-instance.ts';

describe('takeNextReadyInstance', () => {
  it('üres sorra undefined az eredmény', () => {
    expect(takeNextReadyInstance(createSchedulerState())).toBeUndefined();
  });

  it('a sor elején álló példányt adja, és a futók közé teszi', () => {
    const taken = takeNextReadyInstance(enqueueStartInstance(createSchedulerState(), 'start'));

    expect(taken?.ready).toStrictEqual({
      instance: { nodeId: 'start', branchContext: [] },
      arrivalSequence: 0,
    });
    expect(taken?.state.readyInstances).toStrictEqual([]);
    expect(taken?.state.runningInstanceKeys.size).toBe(1);
  });

  it('a sor szigorúan érkezési sorrendben ürül', () => {
    let state = enqueueStartInstance(createSchedulerState(), 'elso');
    state = enqueueStartInstance(state, 'masodik');
    state = enqueueStartInstance(state, 'harmadik');

    const sorrend: string[] = [];
    for (let lepes = 0; lepes < 3; lepes += 1) {
      const taken = takeNextReadyInstance(state);
      if (taken !== undefined) {
        sorrend.push(`${taken.ready.instance.nodeId}:${String(taken.ready.arrivalSequence)}`);
        state = taken.state;
      }
    }

    expect(sorrend).toStrictEqual(['elso:0', 'masodik:1', 'harmadik:2']);
  });

  it('a kapott állapotot érintetlenül hagyja', () => {
    const initial = enqueueStartInstance(createSchedulerState(), 'start');

    takeNextReadyInstance(initial);

    expect(initial.readyInstances).toHaveLength(1);
    expect(initial.runningInstanceKeys.size).toBe(0);
  });
});
