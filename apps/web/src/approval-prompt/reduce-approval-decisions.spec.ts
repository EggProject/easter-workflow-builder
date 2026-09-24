/* eslint-disable unicorn/no-null -- a szintetikus drótszintű fixture-ök nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import type { PendingApproval } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import {
  INITIAL_APPROVAL_DECISIONS_STATE,
  reduceApprovalDecisions,
  type ApprovalDecisionsState,
} from './reduce-approval-decisions.ts';

const APPROVAL: PendingApproval = {
  id: 'a-1',
  runId: 'r-1',
  stepRunId: 's-1',
  title: 'Engedélyezed?',
  body: 'Kérlek erősítsd meg',
  payload: {},
  decision: null,
  requestedAtMs: 1000,
  decidedAtMs: null,
};

const SENT: ApprovalDecisionsState = reduceApprovalDecisions(INITIAL_APPROVAL_DECISIONS_STATE, {
  kind: 'sent',
  approval: APPROVAL,
  decision: 'approved',
});

function answered(outcome: Parameters<typeof reduceApprovalDecisions>[1]): ApprovalDecisionsState {
  return reduceApprovalDecisions(SENT, outcome);
}

describe('reduceApprovalDecisions', () => {
  it('a küldés a jóváhagyást sending állapotban követi', () => {
    expect(SENT.tracked.get('a-1')).toEqual({
      approval: APPROVAL,
      progress: { status: 'sending', decision: 'approved' },
    });
    expect(SENT.hiddenIds.size).toBe(0);
  });

  it('a sikeres válasz decided állapotba visz', () => {
    const state = answered({
      kind: 'answered',
      approval: APPROVAL,
      decision: 'approved',
      outcome: { kind: 'ok', value: APPROVAL },
    });
    expect(state.tracked.get('a-1')?.progress).toEqual({ status: 'decided', decision: 'approved' });
  });

  it('a nem átmeneti hiba (conflict) végleges, az átmeneti hiba nem', () => {
    const conflict = answered({
      kind: 'answered',
      approval: APPROVAL,
      decision: 'approved',
      outcome: { kind: 'error', message: 'ütközés', isTransient: false },
    });
    const network = answered({
      kind: 'answered',
      approval: APPROVAL,
      decision: 'approved',
      outcome: { kind: 'error', message: 'A szerver nem érhető el.', isTransient: true },
    });

    expect(conflict.tracked.get('a-1')?.progress).toEqual({ status: 'failed', message: 'ütközés', isFinal: true });
    expect(network.tracked.get('a-1')?.progress).toEqual({
      status: 'failed',
      message: 'A szerver nem érhető el.',
      isFinal: false,
    });
  });

  it('a nem követett jóváhagyásra érkező választ eldobja (a futás váltása előtti késve érkező válasz)', () => {
    const state = reduceApprovalDecisions(INITIAL_APPROVAL_DECISIONS_STATE, {
      kind: 'answered',
      approval: APPROVAL,
      decision: 'approved',
      outcome: { kind: 'ok', value: APPROVAL },
    });
    expect(state).toBe(INITIAL_APPROVAL_DECISIONS_STATE);
  });

  it('a lezárt döntés nyugtázása törli a követést és véglegesen elrejti a jóváhagyást', () => {
    const decided = answered({
      kind: 'answered',
      approval: APPROVAL,
      decision: 'approved',
      outcome: { kind: 'ok', value: APPROVAL },
    });
    const conflict = answered({
      kind: 'answered',
      approval: APPROVAL,
      decision: 'approved',
      outcome: { kind: 'error', message: 'ütközés', isTransient: false },
    });

    for (const state of [decided, conflict]) {
      const dismissed = reduceApprovalDecisions(state, { kind: 'dismissed', approvalId: 'a-1' });
      expect(dismissed.tracked.has('a-1')).toBe(false);
      expect(dismissed.hiddenIds.has('a-1')).toBe(true);
    }
  });

  it('az átmeneti hiba nyugtázása csak a követést törli, a jóváhagyás újra döntésre kínálható', () => {
    const network = answered({
      kind: 'answered',
      approval: APPROVAL,
      decision: 'approved',
      outcome: { kind: 'error', message: 'A szerver nem érhető el.', isTransient: true },
    });

    const dismissed = reduceApprovalDecisions(network, { kind: 'dismissed', approvalId: 'a-1' });
    expect(dismissed.tracked.has('a-1')).toBe(false);
    expect(dismissed.hiddenIds.has('a-1')).toBe(false);
  });

  it('nem követett azonosító nyugtázása elrejti az azonosítót, a követést nem érinti', () => {
    const dismissed = reduceApprovalDecisions(SENT, { kind: 'dismissed', approvalId: 'ismeretlen' });
    expect(dismissed.tracked.get('a-1')?.progress.status).toBe('sending');
    expect(dismissed.hiddenIds.has('ismeretlen')).toBe(true);
  });

  it('a reset mindent töröl', () => {
    const hidden = reduceApprovalDecisions(SENT, { kind: 'dismissed', approvalId: 'a-2' });
    expect(reduceApprovalDecisions(hidden, { kind: 'reset' })).toBe(INITIAL_APPROVAL_DECISIONS_STATE);
  });
});
