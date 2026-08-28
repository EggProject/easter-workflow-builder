import { describe, expect, it } from 'vitest';
import type { BranchContext } from '../branch-scope/branch-scope.ts';
import { buildFanOutItemContext } from './build-fan-out-item-context.ts';

describe('buildFanOutItemContext', () => {
  it('a gyökér kontextusra egyetlen fan_out keretet tesz', () => {
    expect(buildFanOutItemContext([], 'sr-f', 2)).toStrictEqual([{ kind: 'fan_out', stepRunId: 'sr-f', itemIndex: 2 }]);
  });

  it('a külső hatókört megtartja, és a keretet a verem tetejére teszi', () => {
    const outerContext: BranchContext = [{ kind: 'loop', stepRunId: 'sr-l', iteration: 1 }];

    expect(buildFanOutItemContext(outerContext, 'sr-f', 0)).toStrictEqual([
      { kind: 'loop', stepRunId: 'sr-l', iteration: 1 },
      { kind: 'fan_out', stepRunId: 'sr-f', itemIndex: 0 },
    ]);
  });

  it('a kapott külső vermet nem módosítja', () => {
    const outerContext: BranchContext = [{ kind: 'loop', stepRunId: 'sr-l', iteration: 1 }];

    buildFanOutItemContext(outerContext, 'sr-f', 0);

    expect(outerContext).toHaveLength(1);
  });
});
