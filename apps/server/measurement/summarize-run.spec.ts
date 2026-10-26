import type { RunDetail, StepRunRecord } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { summarizeRun } from './summarize-run.ts';

/* eslint-disable unicorn/no-null -- a rekordok nullázható mezői valódi NULL értéket hordoznak (SPEC-005) */
const RUN: RunDetail = {
  id: 'r1',
  workflowId: 'w1',
  status: 'succeeded',
  input: {},
  providerId: 'minimax',
  rootRunId: 'r1',
  depth: 0,
  workflowAncestry: [],
  graphSnapshotHash: 'h',
  persistedStreamDeltas: false,
  restartedFromRunId: null,
  createdAtMs: 1,
  startedAtMs: 1,
  finishedAtMs: 2,
  errorKind: null,
  errorMessage: null,
};

function step(overrides: Partial<StepRunRecord>): StepRunRecord {
  return {
    id: 's1',
    runId: 'r1',
    nodeId: 'proba',
    nodeType: 'agent_step',
    parentStepRunId: null,
    iteration: 0,
    attempt: 1,
    status: 'succeeded',
    providerId: 'minimax',
    modelId: null,
    sessionMode: 'isolated',
    sdkSessionId: null,
    resumedFromSessionId: null,
    forkedSession: false,
    structuredOutputStrategy: null,
    output: 'szoveg',
    resultSubtype: 'success',
    numTurns: 1,
    inputTokens: null,
    outputTokens: null,
    cacheReadInputTokens: null,
    cacheCreationInputTokens: null,
    subWorkflowRunId: null,
    errorKind: null,
    errorMessage: null,
    startedAtMs: 1,
    finishedAtMs: 2,
    createdAtMs: 1,
    ...overrides,
  };
}
/* eslint-enable unicorn/no-null */

describe('summarizeRun', () => {
  it('a kapott szöveg hosszát adja tovább, a szöveget nem', () => {
    const summary = summarizeRun('minimax', RUN, [step({})], 6);
    expect(summary).toEqual({
      providerId: 'minimax',
      runStatus: 'succeeded',
      stepStatus: 'succeeded',
      resultSubtype: 'success',
      numTurns: 1,
      outputTextLength: 6,
      errorClass: undefined,
    });
  });

  it('lépés nélkül a lépés mezők üresek', () => {
    const summary = summarizeRun('minimax', RUN, [], undefined);
    expect(summary.stepStatus).toBeUndefined();
    expect(summary.numTurns).toBeUndefined();
    expect(summary.outputTextLength).toBeUndefined();
  });

  it('a hibaosztályt előbb a futásból, hiányában a lépésből olvassa', () => {
    expect(
      summarizeRun('minimax', { ...RUN, errorKind: 'run_hiba' }, [step({ errorKind: 'lepes_hiba' })], undefined)
        .errorClass,
    ).toBe('run_hiba');
    expect(summarizeRun('minimax', RUN, [step({ errorKind: 'lepes_hiba' })], undefined).errorClass).toBe('lepes_hiba');
  });
});
