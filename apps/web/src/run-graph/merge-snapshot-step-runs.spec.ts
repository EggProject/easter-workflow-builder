/* eslint-disable unicorn/no-null -- a szintetikus StepRunRecord fixture nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import type { StepRunRecord, WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { mergeSnapshotStepRuns } from './merge-snapshot-step-runs.ts';

const BASE_STEP_RUN: StepRunRecord = {
  id: 's-1',
  runId: 'r-1',
  nodeId: 'n-start',
  nodeType: 'start',
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
  startedAtMs: 100,
  finishedAtMs: 200,
  createdAtMs: 100,
};

const START_NODE: WorkflowNodeInput = {
  id: 'n-start',
  type: 'start',
  label: 'Indítás',
  positionX: 0,
  positionY: 0,
  config: { type: 'start', inputFields: [], onUnhandledError: null },
};

describe('mergeSnapshotStepRuns', () => {
  it('a nodeId mezőn párosít, és egy csomóponthoz több sort is összegyűjt', () => {
    const merged = mergeSnapshotStepRuns(
      [START_NODE],
      [
        { ...BASE_STEP_RUN, id: 's-1' },
        { ...BASE_STEP_RUN, id: 's-2' },
      ],
    );

    expect(merged.nodeStepRuns.get('n-start')?.map((stepRun) => stepRun.id)).toEqual(['s-1', 's-2']);
    expect(merged.unmatchedStepRuns).toEqual([]);
  });

  it('a pillanatképben nem szereplő nodeId-t a nem párosítható listára teszi', () => {
    const merged = mergeSnapshotStepRuns(
      [START_NODE],
      [
        { ...BASE_STEP_RUN, id: 's-1' },
        { ...BASE_STEP_RUN, id: 's-torolt', nodeId: 'n-torolt', nodeType: 'agent_step' },
      ],
    );

    expect(merged.nodeStepRuns.get('n-start')?.map((stepRun) => stepRun.id)).toEqual(['s-1']);
    expect(merged.unmatchedStepRuns.map((stepRun) => stepRun.id)).toEqual(['s-torolt']);
    expect(merged.nodeStepRuns.has('n-torolt')).toBe(false);
  });

  it('lépés futás nélkül üres térképet és üres listát ad', () => {
    const merged = mergeSnapshotStepRuns([START_NODE], []);

    expect(merged.nodeStepRuns.size).toBe(0);
    expect(merged.unmatchedStepRuns).toEqual([]);
  });
});
