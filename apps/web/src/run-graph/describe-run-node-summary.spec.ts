/* eslint-disable unicorn/no-null -- a szintetikus fixture nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import type { StepRunRecord, WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { describeRunNodeSummary } from './describe-run-node-summary.ts';

const BASE_STEP_RUN: StepRunRecord = {
  id: 's-1',
  runId: 'r-1',
  nodeId: 'n-1',
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

const FAN_OUT_NODE: WorkflowNodeInput = {
  id: 'n-1',
  type: 'fan_out',
  label: 'Szétosztás',
  positionX: 0,
  positionY: 0,
  config: { type: 'fan_out', itemsExpression: 'items', branchLabelTemplate: '{{item}}', onUnhandledError: null },
};

const LOOP_NODE: WorkflowNodeInput = {
  id: 'n-2',
  type: 'loop',
  label: 'Ciklus',
  positionX: 0,
  positionY: 0,
  config: { type: 'loop', maxIterations: 7, continueExpression: 'i < 7', onUnhandledError: null },
};

const SUB_WORKFLOW_NODE: WorkflowNodeInput = {
  id: 'n-3',
  type: 'sub_workflow',
  label: 'Al-workflow',
  positionX: 0,
  positionY: 0,
  config: { type: 'sub_workflow', targetWorkflowId: 'wf-2', inputMapping: {}, onUnhandledError: null },
};

const JOIN_NODE: WorkflowNodeInput = {
  id: 'n-4',
  type: 'join',
  label: 'Összefésülés',
  positionX: 0,
  positionY: 0,
  config: { type: 'join', mode: 'merge', settings: {}, onUnhandledError: null },
};

describe('describeRunNodeSummary', () => {
  it('a fan_out ág darabszámát a saját lépés futás kimeneti listájából adja, a hatókör sikeres és bukott soraival', () => {
    const fanOutStepRun: StepRunRecord = { ...BASE_STEP_RUN, id: 's-fan', output: ['a', 'b', 'c'] };
    const summary = describeRunNodeSummary(
      FAN_OUT_NODE,
      [fanOutStepRun],
      [
        fanOutStepRun,
        { ...BASE_STEP_RUN, id: 's-a', nodeId: 'n-inner', nodeType: 'agent_step', parentStepRunId: 's-fan' },
        {
          ...BASE_STEP_RUN,
          id: 's-b',
          nodeId: 'n-inner',
          nodeType: 'agent_step',
          parentStepRunId: 's-fan',
          status: 'failed',
        },
        {
          ...BASE_STEP_RUN,
          id: 's-c',
          nodeId: 'n-inner',
          nodeType: 'agent_step',
          parentStepRunId: 's-fan',
          status: 'running',
        },
        { ...BASE_STEP_RUN, id: 's-other', nodeId: 'n-kivul', nodeType: 'agent_step', parentStepRunId: 's-masik' },
      ],
    );

    expect(summary).toEqual({ kind: 'fan_out', branchCount: 3, succeededCount: 1, failedCount: 1 });
  });

  it('a nulla ág eset nulla darabszámot ad, nem undefined-et', () => {
    const summary = describeRunNodeSummary(FAN_OUT_NODE, [{ ...BASE_STEP_RUN, output: [] }], []);

    expect(summary).toEqual({ kind: 'fan_out', branchCount: 0, succeededCount: 0, failedCount: 0 });
  });

  it('a fan_out összesítése undefined, amíg egyetlen saját sor kimenete sem lista', () => {
    expect(describeRunNodeSummary(FAN_OUT_NODE, [], [])).toBeUndefined();
    expect(describeRunNodeSummary(FAN_OUT_NODE, [{ ...BASE_STEP_RUN, output: null }], [])).toBeUndefined();
  });

  it('a loop az aktuális iterációt és a maxIterations korlátot adja', () => {
    const summary = describeRunNodeSummary(
      LOOP_NODE,
      [
        { ...BASE_STEP_RUN, id: 's-i0', nodeType: 'loop', iteration: 0, createdAtMs: 10 },
        { ...BASE_STEP_RUN, id: 's-i2', nodeType: 'loop', iteration: 2, createdAtMs: 30 },
      ],
      [],
    );

    expect(summary).toEqual({ kind: 'loop', iteration: 2, maxIterations: 7 });
  });

  it('a loop összesítése undefined lépés futás nélkül', () => {
    expect(describeRunNodeSummary(LOOP_NODE, [], [])).toBeUndefined();
  });

  it('a sub_workflow az indult al-workflow futás azonosítóját adja', () => {
    const summary = describeRunNodeSummary(
      SUB_WORKFLOW_NODE,
      [{ ...BASE_STEP_RUN, nodeType: 'sub_workflow', subWorkflowRunId: 'r-9' }],
      [],
    );

    expect(summary).toEqual({ kind: 'sub_workflow', subWorkflowRunId: 'r-9' });
  });

  it('a sub_workflow összesítése undefined, ha még nem indult al-workflow futás', () => {
    expect(describeRunNodeSummary(SUB_WORKFLOW_NODE, [], [])).toBeUndefined();
    expect(
      describeRunNodeSummary(SUB_WORKFLOW_NODE, [{ ...BASE_STEP_RUN, nodeType: 'sub_workflow' }], []),
    ).toBeUndefined();
  });

  it('a többi csomópont típusnak nincs összesítése', () => {
    expect(describeRunNodeSummary(JOIN_NODE, [{ ...BASE_STEP_RUN, nodeType: 'join' }], [])).toBeUndefined();
  });
});
