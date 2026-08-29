/* eslint-disable unicorn/no-null -- a PendingApproval decision/decidedAtMs mezője a dróton ténylegesen `null` értéket hordoz, amíg nincs döntés, nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import { ApprovalDecisionRequestSchema, PendingApprovalSchema } from './pending-approval.ts';

describe('PendingApprovalSchema', () => {
  it('elfogadja az eldöntetlen jóváhagyást, decision: null mellett', () => {
    const outcome = PendingApprovalSchema.safeParse({
      id: 'approval-1',
      runId: 'run-1',
      stepRunId: 'step-1',
      title: 'Jóváhagyás szükséges',
      body: 'Kérlek erősítsd meg',
      payload: {},
      decision: null,
      requestedAtMs: 1,
      decidedAtMs: null,
    });
    expect(outcome.success).toBe(true);
  });

  it('elfogadja az eldöntött jóváhagyást', () => {
    const outcome = PendingApprovalSchema.safeParse({
      id: 'approval-1',
      runId: 'run-1',
      stepRunId: 'step-1',
      title: 'Jóváhagyás szükséges',
      body: 'Kérlek erősítsd meg',
      payload: {},
      decision: 'approved',
      requestedAtMs: 1,
      decidedAtMs: 2,
    });
    expect(outcome.success).toBe(true);
  });
});

describe('ApprovalDecisionRequestSchema', () => {
  it('elfogadja a decision mezőt', () => {
    expect(ApprovalDecisionRequestSchema.safeParse({ decision: 'rejected' }).success).toBe(true);
  });

  it('elutasítja a hiányzó decision mezőt', () => {
    expect(ApprovalDecisionRequestSchema.safeParse({}).success).toBe(false);
  });

  it('elutasítja az ismeretlen kulcsot (15. kritérium)', () => {
    expect(ApprovalDecisionRequestSchema.safeParse({ decision: 'approved', extra: 1 }).success).toBe(false);
  });
});
