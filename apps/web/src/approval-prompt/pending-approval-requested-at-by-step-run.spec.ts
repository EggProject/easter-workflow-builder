/* eslint-disable unicorn/no-null -- a szintetikus PendingApproval fixture nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import type { PendingApproval } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { pendingApprovalRequestedAtByStepRun } from './pending-approval-requested-at-by-step-run.ts';

const BASE_APPROVAL: PendingApproval = {
  id: 'a-1',
  runId: 'r-1',
  stepRunId: 's-1',
  title: 'Engedélyezed?',
  body: 'Kérlek erősítsd meg',
  payload: { amount: 100 },
  decision: null,
  requestedAtMs: 1000,
  decidedAtMs: null,
};

describe('pendingApprovalRequestedAtByStepRun', () => {
  it('lépés futás azonosítónként a requestedAtMs értéket adja', () => {
    const map = pendingApprovalRequestedAtByStepRun([
      BASE_APPROVAL,
      { ...BASE_APPROVAL, id: 'a-2', stepRunId: 's-2', requestedAtMs: 2000 },
    ]);

    expect(map.get('s-1')).toBe(1000);
    expect(map.get('s-2')).toBe(2000);
    expect(map.size).toBe(2);
  });

  it('üres listára üres térképet ad', () => {
    expect(pendingApprovalRequestedAtByStepRun([]).size).toBe(0);
  });
});
