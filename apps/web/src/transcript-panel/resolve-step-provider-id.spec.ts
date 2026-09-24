/* eslint-disable unicorn/no-null -- a StepRunRecord nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-003 4.10) */
import type { StepRunRecord } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { resolveStepProviderId } from './resolve-step-provider-id.ts';

function makeStepRun(id: string, providerId: string): StepRunRecord {
  return {
    id,
    runId: 'run-1',
    nodeId: 'n-1',
    nodeType: 'agent_step',
    parentStepRunId: null,
    iteration: 0,
    attempt: 1,
    status: 'succeeded',
    providerId,
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
    startedAtMs: 1,
    finishedAtMs: 2,
    createdAtMs: 1,
  };
}

const STEP_RUNS = [makeStepRun('s-claude', 'claude-subscription'), makeStepRun('s-minimax', 'minimax')];

describe('resolveStepProviderId', () => {
  it('a stepRunId-hoz tartozó lépés futás providerId mezőjét adja, mindkét providerre', () => {
    expect(resolveStepProviderId(STEP_RUNS, 's-claude')).toBe('claude-subscription');
    expect(resolveStepProviderId(STEP_RUNS, 's-minimax')).toBe('minimax');
  });

  it('lépés nélküli sorra undefined', () => {
    expect(resolveStepProviderId(STEP_RUNS, null)).toBeUndefined();
  });

  it('a betöltött listában nem szereplő lépésre undefined', () => {
    expect(resolveStepProviderId(STEP_RUNS, 's-ismeretlen')).toBeUndefined();
  });

  it('ismeretlen provider azonosítóra undefined, nem találgat', () => {
    expect(resolveStepProviderId([makeStepRun('s-x', 'harmadik-provider')], 's-x')).toBeUndefined();
  });
});
