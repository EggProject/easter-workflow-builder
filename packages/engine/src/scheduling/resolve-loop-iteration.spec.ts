import { describe, expect, it } from 'vitest';
import type { BranchContext } from '../branch-scope/branch-scope.ts';
import type { SchedulerState } from './scheduler-state.ts';
import { buildScopedKey } from './build-scoped-key.ts';
import { createSchedulerState } from './create-scheduler-state.ts';
import { resolveLoopIteration } from './resolve-loop-iteration.ts';

const FAN_OUT_ZERO: BranchContext = [{ kind: 'fan_out', stepRunId: 'sr-f', itemIndex: 0 }];
const FAN_OUT_ONE: BranchContext = [{ kind: 'fan_out', stepRunId: 'sr-f', itemIndex: 1 }];

function stateWithCounts(counts: readonly (readonly [string, number])[]): SchedulerState {
  return { ...createSchedulerState(), loopRunCounts: new Map(counts) };
}

describe('resolveLoopIteration', () => {
  it('még nem futott példányra nulla', () => {
    expect(resolveLoopIteration(createSchedulerState(), { nodeId: 'l', branchContext: [] })).toBe(0);
  });

  it('a nyilvántartott lefutásszámot adja vissza', () => {
    const state = stateWithCounts([[buildScopedKey('l', []), 3]]);

    expect(resolveLoopIteration(state, { nodeId: 'l', branchContext: [] })).toBe(3);
  });

  it('ugyanaz a loop node két fan-out ágban külön iterációszámot vezet', () => {
    const state = stateWithCounts([
      [buildScopedKey('l', FAN_OUT_ZERO), 2],
      [buildScopedKey('l', FAN_OUT_ONE), 5],
    ]);

    expect(resolveLoopIteration(state, { nodeId: 'l', branchContext: FAN_OUT_ZERO })).toBe(2);
    expect(resolveLoopIteration(state, { nodeId: 'l', branchContext: FAN_OUT_ONE })).toBe(5);
  });
});
