/* eslint-disable unicorn/no-null -- a szintetikus fixture nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import type { StepRunRecord, WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { resolveBranchIterationScope } from './resolve-branch-iteration-scope.ts';

const BASE_STEP_RUN: StepRunRecord = {
  id: 's-1',
  runId: 'r-1',
  nodeId: 'n-fan',
  nodeType: 'fan_out',
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

function stepRun(overrides: Partial<StepRunRecord>): StepRunRecord {
  return { ...BASE_STEP_RUN, ...overrides };
}

const LOOP_NODE: WorkflowNodeInput = {
  id: 'n-loop',
  type: 'loop',
  label: 'Ciklus',
  positionX: 0,
  positionY: 0,
  config: { type: 'loop', maxIterations: 3, continueExpression: 'i < 3', onUnhandledError: null },
};

/**
 * A ciklus két iterációja (`s-i0`, `s-i1`), mindkettő törzsében egy lépés,
 * és a ciklusból kilépő ágon egy lépés (`s-after`), ami a hatókörön kívül
 * áll.
 */
const STEP_RUNS: readonly StepRunRecord[] = [
  stepRun({ id: 's-i0', nodeId: 'n-loop', nodeType: 'loop', iteration: 0 }),
  stepRun({ id: 's-body-0', nodeId: 'n-body', parentStepRunId: 's-i0' }),
  stepRun({ id: 's-i1', nodeId: 'n-loop', nodeType: 'loop', iteration: 1 }),
  stepRun({ id: 's-body-1', nodeId: 'n-body', parentStepRunId: 's-i1', iteration: 1 }),
  stepRun({ id: 's-after', nodeId: 'n-after' }),
];

describe('resolveBranchIterationScope', () => {
  it('tétel nélkül a csomópont minden saját lépés futását és a leszármazottjait adja', () => {
    const scope = resolveBranchIterationScope({ node: LOOP_NODE, kind: 'loop', stepRunId: undefined }, STEP_RUNS);
    expect(scope).toEqual(new Set(['s-i0', 's-body-0', 's-i1', 's-body-1']));
  });

  it('kiválasztott tétellel csak a tétel lépés futását és a leszármazottjait adja', () => {
    const scope = resolveBranchIterationScope({ node: LOOP_NODE, kind: 'loop', stepRunId: 's-i1' }, STEP_RUNS);
    expect([...scope]).toEqual(['s-i1', 's-body-1']);
  });

  it('még nem futott csomópontra tétel nélkül üres halmazt ad', () => {
    const scope = resolveBranchIterationScope({ node: LOOP_NODE, kind: 'loop', stepRunId: undefined }, []);
    expect(scope.size).toBe(0);
  });
});
