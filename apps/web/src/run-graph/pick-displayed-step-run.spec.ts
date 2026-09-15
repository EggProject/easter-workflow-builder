/* eslint-disable unicorn/no-null -- a szintetikus StepRunRecord fixture nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import type { StepRunRecord } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { pickDisplayedStepRun } from './pick-displayed-step-run.ts';

const BASE_STEP_RUN: StepRunRecord = {
  id: 's-1',
  runId: 'r-1',
  nodeId: 'n-loop',
  nodeType: 'loop',
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

describe('pickDisplayedStepRun', () => {
  it('üres listára undefined-et ad', () => {
    expect(pickDisplayedStepRun([])).toBeUndefined();
  });

  it('a legkésőbb létrejött sort adja, a lista sorrendjétől függetlenül', () => {
    const picked = pickDisplayedStepRun([
      { ...BASE_STEP_RUN, id: 's-late', createdAtMs: 300, status: 'running' },
      { ...BASE_STEP_RUN, id: 's-early', createdAtMs: 100 },
    ]);

    expect(picked?.id).toBe('s-late');
  });

  it('azonos createdAtMs esetén a lista későbbi eleme győz (beszúrási sorrend)', () => {
    const picked = pickDisplayedStepRun([
      { ...BASE_STEP_RUN, id: 's-first', createdAtMs: 100 },
      { ...BASE_STEP_RUN, id: 's-second', createdAtMs: 100 },
    ]);

    expect(picked?.id).toBe('s-second');
  });
});
