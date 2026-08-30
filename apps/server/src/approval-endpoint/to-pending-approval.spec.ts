/* eslint-disable unicorn/no-null -- a HumanApprovalRecord mezői valódi Date | null típusúak */
import { describe, expect, it } from 'vitest';
import type { HumanApprovalRecord } from '@easter-workflow-builder/db';
import { toPendingApproval } from './to-pending-approval.ts';

const BASE_RECORD: HumanApprovalRecord = {
  id: 'approval-1',
  runId: 'run-1',
  stepRunId: 'step-1',
  title: 'Cím',
  body: 'Törzs',
  payload: { a: 1 },
  decision: null,
  requestedAtMs: new Date(1000),
  decidedAtMs: null,
};

describe('toPendingApproval', () => {
  it('a Date mezőket egész milliszekundummá alakítja', () => {
    expect(toPendingApproval(BASE_RECORD)).toStrictEqual({
      id: 'approval-1',
      runId: 'run-1',
      stepRunId: 'step-1',
      title: 'Cím',
      body: 'Törzs',
      payload: { a: 1 },
      decision: null,
      requestedAtMs: 1000,
      decidedAtMs: null,
    });
  });

  it('a null decidedAtMs mezőt null egészként adja vissza', () => {
    const result = toPendingApproval({ ...BASE_RECORD, decision: 'approved', decidedAtMs: new Date(2000) });
    expect(result.decidedAtMs).toBe(2000);
  });
});
