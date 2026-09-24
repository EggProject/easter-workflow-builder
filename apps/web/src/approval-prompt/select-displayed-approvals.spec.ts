/* eslint-disable unicorn/no-null -- a szintetikus drótszintű fixture-ök nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import type { PendingApproval } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { INITIAL_APPROVAL_DECISIONS_STATE, type ApprovalDecisionsState } from './reduce-approval-decisions.ts';
import { selectDisplayedApprovals } from './select-displayed-approvals.ts';

function approval(id: string, requestedAtMs: number): PendingApproval {
  return {
    id,
    runId: 'r-1',
    stepRunId: `s-${id}`,
    title: id,
    body: '',
    payload: {},
    decision: null,
    requestedAtMs,
    decidedAtMs: null,
  };
}

const FIRST = approval('a-1', 100);
const SECOND = approval('a-2', 200);
const THIRD = approval('a-3', 300);

describe('selectDisplayedApprovals', () => {
  it('döntés nélkül a lista, döntés állapot nélkül', () => {
    expect(selectDisplayedApprovals([FIRST, SECOND], INITIAL_APPROVAL_DECISIONS_STATE)).toEqual([
      { approval: FIRST, progress: undefined },
      { approval: SECOND, progress: undefined },
    ]);
  });

  it('a listából kikerült, de még nem nyugtázott döntés kártyája a kérés időpontja szerinti helyén marad', () => {
    const decisions: ApprovalDecisionsState = {
      tracked: new Map([['a-1', { approval: FIRST, progress: { status: 'decided', decision: 'approved' } }]]),
      hiddenIds: new Set(),
    };

    expect(selectDisplayedApprovals([SECOND, THIRD], decisions)).toEqual([
      { approval: FIRST, progress: { status: 'decided', decision: 'approved' } },
      { approval: SECOND, progress: undefined },
      { approval: THIRD, progress: undefined },
    ]);
  });

  it('a listában is szereplő követett jóváhagyás egyszer jelenik meg, a döntés állapotával', () => {
    const decisions: ApprovalDecisionsState = {
      tracked: new Map([['a-2', { approval: SECOND, progress: { status: 'sending', decision: 'rejected' } }]]),
      hiddenIds: new Set(),
    };

    expect(selectDisplayedApprovals([FIRST, SECOND], decisions)).toEqual([
      { approval: FIRST, progress: undefined },
      { approval: SECOND, progress: { status: 'sending', decision: 'rejected' } },
    ]);
  });

  it('a nyugtázott lezárt döntés akkor sem jelenik meg, ha az elavult lista még tartalmazza', () => {
    const decisions: ApprovalDecisionsState = { tracked: new Map(), hiddenIds: new Set(['a-1']) };

    expect(selectDisplayedApprovals([FIRST, SECOND], decisions)).toEqual([{ approval: SECOND, progress: undefined }]);
  });

  it('azonos kérés időpontnál a lista sorrendje marad', () => {
    const twin = approval('a-0', 100);
    expect(
      selectDisplayedApprovals([FIRST, twin], INITIAL_APPROVAL_DECISIONS_STATE).map((item) => item.approval.id),
    ).toEqual(['a-1', 'a-0']);
  });
});
