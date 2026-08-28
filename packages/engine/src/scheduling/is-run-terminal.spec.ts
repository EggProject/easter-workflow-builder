import { describe, expect, it } from 'vitest';
import { createSchedulerState } from './create-scheduler-state.ts';
import { enqueueStartInstance } from './enqueue-start-instance.ts';
import { isRunTerminal } from './is-run-terminal.ts';
import { takeNextReadyInstance } from './take-next-ready-instance.ts';

describe('isRunTerminal', () => {
  it('az üres ütemező terminális', () => {
    expect(isRunTerminal(createSchedulerState())).toBe(true);
  });

  it('futtatható példány mellett nem terminális', () => {
    const state = enqueueStartInstance(createSchedulerState(), 'start');

    expect(isRunTerminal(state)).toBe(false);
  });

  it('futó példány mellett sem terminális, akkor sem, ha a sor kiürült', () => {
    const state = enqueueStartInstance(createSchedulerState(), 'start');
    const taken = takeNextReadyInstance(state);

    expect(taken?.state.readyInstances).toStrictEqual([]);
    expect(taken === undefined ? undefined : isRunTerminal(taken.state)).toBe(false);
  });
});
