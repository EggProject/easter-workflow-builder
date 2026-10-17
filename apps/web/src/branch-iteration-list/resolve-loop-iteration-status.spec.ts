/* eslint-disable unicorn/no-null -- a szintetikus fixture nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import type { StepRunRecord, StepRunStatus } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { resolveLoopIterationStatus } from './resolve-loop-iteration-status.ts';

const BASE_STEP_RUN: StepRunRecord = {
  id: 's-i0',
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
  startedAtMs: 10,
  finishedAtMs: 20,
  createdAtMs: 10,
};

const ITERATION = BASE_STEP_RUN;

/**
 * Az iteráció törzsének egy lépése (a szülője az iteráció lépés futása).
 */
function bodyStep(id: string, status: StepRunStatus, parentStepRunId = ITERATION.id): StepRunRecord {
  return { ...BASE_STEP_RUN, id, nodeId: `n-${id}`, nodeType: 'agent_step', parentStepRunId, status };
}

/**
 * A nyolc állapot az erősségük sorrendjében, az erősebbtől a gyengébbig.
 */
const STATUSES_BY_STRENGTH: readonly StepRunStatus[] = [
  'failed',
  'rejected',
  'interrupted',
  'cancelled',
  'waiting_approval',
  'running',
  'pending',
  'succeeded',
];

describe('resolveLoopIterationStatus', () => {
  it('lépés nélküli iterációnál a kiértékelés saját állapota marad', () => {
    expect(resolveLoopIterationStatus(ITERATION, [ITERATION])).toBe('succeeded');
    const failedEvaluation = { ...ITERATION, status: 'failed' as const };
    expect(resolveLoopIterationStatus(failedEvaluation, [failedEvaluation])).toBe('failed');
    const runningEvaluation = { ...ITERATION, status: 'running' as const };
    expect(resolveLoopIterationStatus(runningEvaluation, [runningEvaluation])).toBe('running');
  });

  it('egy elbukott lépés a sikeres kiértékelés és a sikeres lépések mellett is sikertelenné teszi az iterációt', () => {
    expect(
      resolveLoopIterationStatus(ITERATION, [
        ITERATION,
        bodyStep('a', 'succeeded'),
        bodyStep('b', 'failed'),
        bodyStep('c', 'succeeded'),
      ]),
    ).toBe('failed');
  });

  it('minden lépés sikeres: az iteráció sikeres', () => {
    expect(
      resolveLoopIterationStatus(ITERATION, [ITERATION, bodyStep('a', 'succeeded'), bodyStep('b', 'succeeded')]),
    ).toBe('succeeded');
  });

  it('a beágyazott hatókör lépése is számít, a lánc mentén', () => {
    expect(
      resolveLoopIterationStatus(ITERATION, [
        ITERATION,
        bodyStep('inner-fan', 'succeeded'),
        bodyStep('inner-branch', 'waiting_approval', 'inner-fan'),
      ]),
    ).toBe('waiting_approval');
  });

  it('egy másik iteráció és a hatókörön kívüli lépés nem számít', () => {
    const otherIteration = { ...ITERATION, id: 's-i1', iteration: 1 };
    expect(
      resolveLoopIterationStatus(ITERATION, [
        ITERATION,
        otherIteration,
        bodyStep('a', 'succeeded'),
        bodyStep('other', 'failed', otherIteration.id),
        { ...bodyStep('outside', 'failed'), parentStepRunId: null },
      ]),
    ).toBe('succeeded');
  });

  it.each(
    STATUSES_BY_STRENGTH.flatMap((stronger, strongerIndex) =>
      STATUSES_BY_STRENGTH.slice(strongerIndex + 1).map((weaker) => [stronger, weaker] as const),
    ),
  )('%s erősebb, mint %s, bármelyik sorrendben', (stronger, weaker) => {
    expect(resolveLoopIterationStatus(ITERATION, [ITERATION, bodyStep('a', stronger), bodyStep('b', weaker)])).toBe(
      stronger,
    );
    expect(resolveLoopIterationStatus(ITERATION, [ITERATION, bodyStep('a', weaker), bodyStep('b', stronger)])).toBe(
      stronger,
    );
  });
});
