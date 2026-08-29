import { describe, expect, it } from 'vitest';
import { InterruptSummaryResponseSchema } from './interrupt-summary.ts';

describe('InterruptSummaryResponseSchema', () => {
  it('elfogadja a gyökér futást és a megszakított futások listáját', () => {
    const outcome = InterruptSummaryResponseSchema.safeParse({
      rootRunId: 'run-1',
      cancelledRunIds: ['run-1', 'run-2'],
    });
    expect(outcome.success).toBe(true);
  });

  it('elfogadja az üres cancelledRunIds listát is', () => {
    expect(InterruptSummaryResponseSchema.safeParse({ rootRunId: 'run-1', cancelledRunIds: [] }).success).toBe(true);
  });
});
