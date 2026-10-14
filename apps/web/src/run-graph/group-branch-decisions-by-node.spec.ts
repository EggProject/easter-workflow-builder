/* eslint-disable unicorn/no-null -- a szintetikus drótszintű fixture-ök nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import type { StepRunRecord } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import type { BranchDecision } from './branch-decision.ts';
import { groupBranchDecisionsByNode } from './group-branch-decisions-by-node.ts';

const BRANCH_STEP_RUN: StepRunRecord = {
  id: 's-branch-1',
  runId: 'r-1',
  nodeId: 'n-branch',
  nodeType: 'branch',
  parentStepRunId: null,
  iteration: 0,
  attempt: 1,
  status: 'succeeded',
  providerId: 'minimax',
  modelId: null,
  sessionMode: null,
  sdkSessionId: null,
  resumedFromSessionId: null,
  forkedSession: false,
  structuredOutputStrategy: null,
  output: null,
  resultSubtype: null,
  numTurns: null,
  inputTokens: null,
  outputTokens: null,
  cacheReadInputTokens: null,
  cacheCreationInputTokens: null,
  subWorkflowRunId: null,
  errorKind: null,
  errorMessage: null,
  startedAtMs: 10,
  finishedAtMs: 11,
  createdAtMs: 10,
};

function decision(eventId: number, stepRunId: string): BranchDecision {
  return { eventId, stepRunId, branchKey: 'igen', usedDefault: false };
}

function decisionMap(decisions: readonly BranchDecision[]): ReadonlyMap<number, BranchDecision> {
  return new Map(decisions.map((entry) => [entry.eventId, entry]));
}

describe('groupBranchDecisionsByNode', () => {
  it('üres döntés térképre üres eredményt ad', () => {
    expect(groupBranchDecisionsByNode(new Map(), [BRANCH_STEP_RUN]).size).toBe(0);
  });

  it('a döntést a lépés futás nodeId mezője szerinti csomóponthoz köti', () => {
    const grouped = groupBranchDecisionsByNode(decisionMap([decision(5, 's-branch-1')]), [BRANCH_STEP_RUN]);

    expect(Object.fromEntries(grouped)).toEqual({ 'n-branch': [decision(5, 's-branch-1')] });
  });

  it('egy csomópont döntései növekvő eventId szerint állnak, a beérkezés sorrendjétől függetlenül', () => {
    const stepRuns = [BRANCH_STEP_RUN, { ...BRANCH_STEP_RUN, id: 's-branch-2', iteration: 1 }];
    const arrivedOutOfOrder = decisionMap([decision(12, 's-branch-2'), decision(5, 's-branch-1')]);

    const grouped = groupBranchDecisionsByNode(arrivedOutOfOrder, stepRuns);

    expect(grouped.get('n-branch')?.map((entry) => entry.eventId)).toEqual([5, 12]);
  });

  it('több csomópont döntéseit külön listába teszi', () => {
    const stepRuns = [BRANCH_STEP_RUN, { ...BRANCH_STEP_RUN, id: 's-other', nodeId: 'n-other-branch' }];

    const grouped = groupBranchDecisionsByNode(
      decisionMap([decision(5, 's-branch-1'), decision(6, 's-other')]),
      stepRuns,
    );

    expect(grouped.get('n-branch')?.map((entry) => entry.eventId)).toEqual([5]);
    expect(grouped.get('n-other-branch')?.map((entry) => entry.eventId)).toEqual([6]);
  });

  it('a még le nem képezhető döntés nem hiba, és a lépés futás lista frissülése után leképeződik', () => {
    const decisions = decisionMap([decision(5, 's-branch-1'), decision(8, 's-branch-2')]);
    const secondStepRun = { ...BRANCH_STEP_RUN, id: 's-branch-2', iteration: 1 };

    const before = groupBranchDecisionsByNode(decisions, [BRANCH_STEP_RUN]);
    expect(before.get('n-branch')?.map((entry) => entry.eventId)).toEqual([5]);

    const after = groupBranchDecisionsByNode(decisions, [BRANCH_STEP_RUN, secondStepRun]);
    expect(after.get('n-branch')?.map((entry) => entry.eventId)).toEqual([5, 8]);
  });
});
