import { describe, expect, it } from 'vitest';
import { DeleteWorkflowRequestSchema, DeletionSummarySchema } from './delete-workflow-request.ts';

describe('DeleteWorkflowRequestSchema', () => {
  it('elfogadja az acknowledgeIrreversible: true törzset', () => {
    expect(DeleteWorkflowRequestSchema.safeParse({ acknowledgeIrreversible: true }).success).toBe(true);
  });

  it('elutasítja a false értéket (13. kritérium, 1/3 eset)', () => {
    expect(DeleteWorkflowRequestSchema.safeParse({ acknowledgeIrreversible: false }).success).toBe(false);
  });

  it('elutasítja a hiányzó mezőt (13. kritérium, 2/3 eset)', () => {
    expect(DeleteWorkflowRequestSchema.safeParse({}).success).toBe(false);
  });

  it('elutasítja a hiányzó törzset, undefined bemenetként (13. kritérium, 3/3 eset)', () => {
    expect(DeleteWorkflowRequestSchema.safeParse(undefined).success).toBe(false);
  });
});

describe('DeletionSummarySchema', () => {
  it('elfogadja a három darabszám mezőt', () => {
    const outcome = DeletionSummarySchema.safeParse({ runCount: 3, eventCount: 120, snapshotCount: 1 });
    expect(outcome.success).toBe(true);
  });

  it('elutasítja a negatív darabszámot', () => {
    expect(DeletionSummarySchema.safeParse({ runCount: -1, eventCount: 0, snapshotCount: 0 }).success).toBe(false);
  });
});
