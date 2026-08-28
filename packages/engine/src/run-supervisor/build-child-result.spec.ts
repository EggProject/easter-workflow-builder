/* eslint-disable unicorn/no-null -- a `WorkflowRunRecord` és a `RunCompletion` nullázható mezői (SPEC-003 4.8, SPEC-004 8.4) valódi `null` értéket hordoznak */
import { describe, expect, it } from 'vitest';
import type { Outcome } from '@easter-workflow-builder/core';
import type { NodeType, SnapshotEdge, SnapshotNode, WorkflowRunRecord } from '@easter-workflow-builder/db';
import type { RunCompletion } from '../error-policy/run-completion.ts';
import type { ExecutedStepInstance } from '../run-context/executed-step-instance.ts';
import { buildExecutableGraph } from '../run-graph/build-executable-graph.ts';
import { buildChildResult } from './build-child-result.ts';

function node(id: string, type: NodeType): SnapshotNode {
  return { id, type, label: id, position: { x: 0, y: 0 }, config: {}, effectiveProviderId: 'minimax' };
}
function edge(id: string, sourceNodeId: string, targetNodeId: string): SnapshotEdge {
  return { id, sourceNodeId, targetNodeId, sourceHandle: null, targetHandle: null, branchKey: null };
}

const GRAPH = buildExecutableGraph({
  version: 1,
  sdkVersionPin: '0.0.0-teszt',
  workflow: { id: 'wf', name: 'teszt', description: null },
  nodes: [node('start', 'start'), node('veg', 'branch')],
  edges: [edge('e1', 'start', 'veg')],
});

const EXECUTED: readonly ExecutedStepInstance[] = [{ nodeId: 'veg', branchContext: [], output: { kesz: true } }];

const COMPLETION: Outcome<RunCompletion> = {
  kind: 'ok',
  value: { status: 'succeeded', errorKind: null, errorMessage: null, failedBranchCount: 0 },
};

const RUN: Outcome<WorkflowRunRecord> = {
  kind: 'ok',
  value: {
    id: 'run-1',
    workflowId: 'wf',
    status: 'succeeded',
    input: {},
    providerId: 'minimax',
    rootRunId: 'run-0',
    depth: 1,
    workflowAncestry: ['wf-szulo', 'wf'],
    graphSnapshotHash: 'hash',
    persistedStreamDeltas: false,
    restartedFromRunId: null,
    createdAtMs: new Date(0),
    startedAtMs: new Date(0),
    finishedAtMs: new Date(1),
    errorKind: null,
    errorMessage: null,
  },
};

describe('buildChildResult', () => {
  it('sikeres léptetés és beolvasás esetén a rekordot és a terminális kimenetet adja', () => {
    const outcome = buildChildResult(COMPLETION, RUN, GRAPH, EXECUTED);

    expect(outcome.kind).toBe('ok');
    expect(outcome.kind === 'ok' ? outcome.value.run.id : '').toBe('run-1');
    expect(outcome.kind === 'ok' ? outcome.value.output : undefined).toStrictEqual({ kesz: true });
  });

  it('a léptetés hibája megy tovább', () => {
    const outcome = buildChildResult({ kind: 'error', message: 'léptetési hiba' }, RUN, GRAPH, EXECUTED);

    expect(outcome).toStrictEqual({ kind: 'error', message: 'léptetési hiba' });
  });

  it('a futás visszaolvasásának hibája megy tovább', () => {
    const outcome = buildChildResult(COMPLETION, { kind: 'error', message: 'nincs futás' }, GRAPH, EXECUTED);

    expect(outcome).toStrictEqual({ kind: 'error', message: 'nincs futás' });
  });
});
