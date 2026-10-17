/* eslint-disable unicorn/no-null -- a szintetikus fixture nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import type { StepRunRecord, WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { buildBranchIterationItems } from './build-branch-iteration-items.ts';

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

const FAN_OUT_NODE: WorkflowNodeInput = {
  id: 'n-fan',
  type: 'fan_out',
  label: 'Elemek szétosztása',
  positionX: 0,
  positionY: 0,
  config: { type: 'fan_out', itemsExpression: 'items', branchLabelTemplate: '{{item}}', onUnhandledError: null },
};

const LOOP_NODE: WorkflowNodeInput = {
  id: 'n-loop',
  type: 'loop',
  label: 'Ismétlés',
  positionX: 0,
  positionY: 0,
  config: { type: 'loop', maxIterations: 5, continueExpression: 'i < 5', onUnhandledError: null },
};

/**
 * Az ágakban futó lépés csomópontja: a felirat a pillanatkép `label`
 * mezőjéből jön, a konfiguráció típusa a lista szempontjából közömbös.
 */
const BRANCH_STEP_NODE: WorkflowNodeInput = {
  id: 'n-agent',
  type: 'start',
  label: 'Elemzés',
  positionX: 0,
  positionY: 0,
  config: { type: 'start', inputFields: [], onUnhandledError: null },
};

const NODES: readonly WorkflowNodeInput[] = [FAN_OUT_NODE, LOOP_NODE, BRANCH_STEP_NODE];

/**
 * A szétosztás (`s-fan`) három ága: kettő az ügynök lépés csomópontján, egy a
 * pillanatképben nem szereplő csomóponton (a `step_run.node_id` nem idegen
 * kulcs, SPEC-003 4.10). A ciklus (`n-loop`) két iterációja a szétosztás
 * előtt fut, a törzsében egy lépéssel, ami nem tétele a ciklus listájának. A
 * sorrend szándékosan nem a létrehozás sorrendje.
 */
const STEP_RUNS: readonly StepRunRecord[] = [
  stepRun({ id: 's-fan', nodeId: 'n-fan', createdAtMs: 30 }),
  stepRun({
    id: 's-b',
    nodeId: 'n-agent',
    nodeType: 'agent_step',
    parentStepRunId: 's-fan',
    createdAtMs: 32,
    status: 'running',
  }),
  stepRun({
    id: 's-a',
    nodeId: 'n-agent',
    nodeType: 'agent_step',
    parentStepRunId: 's-fan',
    createdAtMs: 31,
    status: 'failed',
  }),
  stepRun({ id: 's-c', nodeId: 'n-torolt', nodeType: 'agent_step', parentStepRunId: 's-fan', createdAtMs: 33 }),
  stepRun({ id: 's-a-nested', nodeId: 'n-agent', nodeType: 'agent_step', parentStepRunId: 's-a', createdAtMs: 34 }),
  stepRun({ id: 's-i1', nodeId: 'n-loop', nodeType: 'loop', iteration: 1, createdAtMs: 12 }),
  stepRun({ id: 's-i0', nodeId: 'n-loop', nodeType: 'loop', iteration: 0, createdAtMs: 10 }),
  stepRun({ id: 's-body', nodeId: 'n-agent', nodeType: 'agent_step', parentStepRunId: 's-i0', createdAtMs: 11 }),
];

describe('buildBranchIterationItems', () => {
  it('a fan_out tételei a hatókörében közvetlenül futó lépés futások, létrehozási sorrendben, sorszámmal és a lépés nevével', () => {
    expect(buildBranchIterationItems({ node: FAN_OUT_NODE, kind: 'fan_out' }, NODES, STEP_RUNS)).toEqual([
      { stepRunId: 's-a', label: '1. Elemzés', status: 'failed' },
      { stepRunId: 's-b', label: '2. Elemzés', status: 'running' },
      { stepRunId: 's-c', label: '3. n-torolt', status: 'succeeded' },
    ]);
  });

  it('a loop tételei a csomópont saját lépés futásai, létrehozási sorrendben, a kártya "iteráció: N / M" feliratával', () => {
    expect(buildBranchIterationItems({ node: LOOP_NODE, kind: 'loop' }, NODES, STEP_RUNS)).toEqual([
      { stepRunId: 's-i0', label: 'iteráció: 0 / 5', status: 'succeeded' },
      { stepRunId: 's-i1', label: 'iteráció: 1 / 5', status: 'succeeded' },
    ]);
  });

  it('a loop tételének állapota az iteráció lépéseiből jön, nem a kiértékelés saját állapotából', () => {
    const failedBody = STEP_RUNS.map((candidate) =>
      candidate.id === 's-body' ? { ...candidate, status: 'failed' as const } : candidate,
    );
    expect(
      buildBranchIterationItems({ node: LOOP_NODE, kind: 'loop' }, NODES, failedBody).map((item) => item.status),
    ).toEqual(['failed', 'succeeded']);
  });

  it('még nem futott csomópontra üres listát ad', () => {
    expect(buildBranchIterationItems({ node: FAN_OUT_NODE, kind: 'fan_out' }, NODES, [])).toEqual([]);
    expect(buildBranchIterationItems({ node: LOOP_NODE, kind: 'loop' }, NODES, [])).toEqual([]);
  });

  it('azonos létrehozási időpontnál a lépés futás lista sorrendje marad', () => {
    const tied = [
      stepRun({ id: 's-fan', nodeId: 'n-fan' }),
      stepRun({ id: 's-y', nodeId: 'n-agent', parentStepRunId: 's-fan', createdAtMs: 40 }),
      stepRun({ id: 's-x', nodeId: 'n-agent', parentStepRunId: 's-fan', createdAtMs: 40 }),
    ];
    expect(
      buildBranchIterationItems({ node: FAN_OUT_NODE, kind: 'fan_out' }, NODES, tied).map((item) => item.stepRunId),
    ).toEqual(['s-y', 's-x']);
  });
});
