/* eslint-disable unicorn/no-null -- a szintetikus drótszintű fixture-ök nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import type { PendingApproval } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import type { DisplayedApproval } from './select-displayed-approvals.ts';
import { selectShownApproval } from './select-shown-approval.ts';

function approval(id: string, requestedAtMs: number): PendingApproval {
  return {
    id,
    runId: 'r-1',
    stepRunId: `s-${id}`,
    title: 'Azonos cím',
    body: 'Kérlek erősítsd meg',
    payload: { id },
    decision: null,
    requestedAtMs,
    decidedAtMs: null,
  };
}

const FIRST: DisplayedApproval = { approval: approval('a-1', 1000), progress: undefined };
const SECOND: DisplayedApproval = {
  approval: approval('a-2', 2000),
  progress: { status: 'decided', decision: 'approved' },
};
const THIRD: DisplayedApproval = { approval: approval('a-3', 3000), progress: undefined };

describe('selectShownApproval', () => {
  it('üres listára nincs látott jóváhagyás', () => {
    expect(selectShownApproval([], undefined)).toBeUndefined();
    expect(selectShownApproval([], 'a-1')).toBeUndefined();
  });

  it('kiválasztás nélkül a lista első eleme, a legrégebbi kérés látszik', () => {
    expect(selectShownApproval([FIRST, SECOND, THIRD], undefined)).toEqual({ ...FIRST, index: 0 });
  });

  it('a kiválasztott azonosító látszik, a helyével és a döntés állapotával', () => {
    expect(selectShownApproval([FIRST, SECOND, THIRD], 'a-2')).toEqual({ ...SECOND, index: 1 });
  });

  it('ha a lista a kiválasztott elé bővül, a kiválasztott marad, csak a helye nő', () => {
    const older: DisplayedApproval = { approval: approval('a-0', 500), progress: undefined };
    expect(selectShownApproval([older, FIRST, SECOND, THIRD], 'a-3')).toEqual({ ...THIRD, index: 3 });
  });

  it('ha a kiválasztott előtti elem kikerül, a kiválasztott marad, csak a helye csökken', () => {
    expect(selectShownApproval([SECOND, THIRD], 'a-3')).toEqual({ ...THIRD, index: 1 });
  });

  it('ha a kiválasztott maga kikerül, a legrégebbi látszik', () => {
    expect(selectShownApproval([FIRST, THIRD], 'a-2')).toEqual({ ...FIRST, index: 0 });
  });
});
