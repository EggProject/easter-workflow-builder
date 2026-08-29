import { describe, expect, it } from 'vitest';
import { RunInterruptedReasonSchema } from './run-interrupted-reason.ts';

describe('RunInterruptedReasonSchema', () => {
  it.each(['startup_recovery', 'graceful_shutdown'] as const)('elfogadja a(z) "%s" értéket', (value) => {
    expect(RunInterruptedReasonSchema.safeParse(value).success).toBe(true);
  });

  it('elutasítja az ismeretlen értéket', () => {
    expect(RunInterruptedReasonSchema.safeParse('unknown_reason').success).toBe(false);
  });
});
