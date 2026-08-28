import { describe, expect, it } from 'vitest';
import type { BranchContext } from '../branch-scope/branch-scope.ts';
import type { SchedulerState } from './scheduler-state.ts';
import { createSchedulerState } from './create-scheduler-state.ts';
import { resolveFanOutItem } from './resolve-fan-out-item.ts';

function stateWithItems(entries: readonly (readonly [string, readonly unknown[]])[]): SchedulerState {
  return { ...createSchedulerState(), fanOutItems: new Map(entries) };
}

describe('resolveFanOutItem', () => {
  it('fan_out keret nélküli kontextusra undefined', () => {
    const state = stateWithItems([['sr-f', ['a', 'b']]]);
    const context: BranchContext = [{ kind: 'loop', stepRunId: 'sr-l', iteration: 0 }];

    expect(resolveFanOutItem(state, context)).toBeUndefined();
  });

  it('a keret sorszámához tartozó elem értékét adja', () => {
    const state = stateWithItems([['sr-f', ['a', 'b', 'c']]]);
    const context: BranchContext = [{ kind: 'fan_out', stepRunId: 'sr-f', itemIndex: 2 }];

    expect(resolveFanOutItem(state, context)).toBe('c');
  });

  it('ismeretlen hatókörre undefined, mert nincs nyilvántartott elem lista', () => {
    const context: BranchContext = [{ kind: 'fan_out', stepRunId: 'sr-ismeretlen', itemIndex: 0 }];

    expect(resolveFanOutItem(createSchedulerState(), context)).toBeUndefined();
  });

  it('egymásba ágyazott fan_out hatókörök közül a legbelsőt adja', () => {
    const state = stateWithItems([
      ['sr-kulso', ['kulso-0', 'kulso-1']],
      ['sr-belso', ['belso-0', 'belso-1']],
    ]);
    const context: BranchContext = [
      { kind: 'fan_out', stepRunId: 'sr-kulso', itemIndex: 1 },
      { kind: 'fan_out', stepRunId: 'sr-belso', itemIndex: 0 },
    ];

    expect(resolveFanOutItem(state, context)).toBe('belso-0');
  });

  it('a legbelső fan_out keret akkor is látszik, ha fölötte loop keret áll', () => {
    const state = stateWithItems([['sr-f', ['a', 'b']]]);
    const context: BranchContext = [
      { kind: 'fan_out', stepRunId: 'sr-f', itemIndex: 1 },
      { kind: 'loop', stepRunId: 'sr-l', iteration: 3 },
    ];

    expect(resolveFanOutItem(state, context)).toBe('b');
  });
});
