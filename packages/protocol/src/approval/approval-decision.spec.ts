import { describe, expect, it } from 'vitest';
import { ApprovalDecisionSchema } from './approval-decision.ts';

describe('ApprovalDecisionSchema', () => {
  it('elfogadja az approved és rejected értéket', () => {
    expect(ApprovalDecisionSchema.safeParse('approved').success).toBe(true);
    expect(ApprovalDecisionSchema.safeParse('rejected').success).toBe(true);
  });

  it('ismeretlen döntést elutasít', () => {
    expect(ApprovalDecisionSchema.safeParse('maybe').success).toBe(false);
  });
});
