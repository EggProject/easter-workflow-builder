/* eslint-disable unicorn/no-null -- a `GraphSnapshotDocument.workflow.description`, a lépés sor nullázható mezői és a `RunCompletion` `succeeded` ágának mezői tárolt `null` értéket hordoznak, nem helyőrző `undefined`-et */
import { describe, expect, it, vi } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import type { DatabaseContext, WorkflowRunRecord } from '@easter-workflow-builder/db';
import { openDatabase } from '@easter-workflow-builder/db';
import { createConcurrencyGate } from '../concurrency-gate/create-concurrency-gate.ts';
import type { RunCompletion } from '../error-policy/run-completion.ts';
import { createApprovalWaitRegistry } from '../node-executor/approval-wait-registry.ts';
import type { ActiveRunHandle } from '../run-supervisor/active-run-registry.ts';
import { createAgentQueryRegistry } from './agent-query-registry.ts';
import type { CancelActiveRunTreeDependencies } from './cancel-active-run-tree.ts';
import { cancelActiveRunTree } from './cancel-active-run-tree.ts';

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (!isOkOutcome(outcome)) {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

interface SeededRun {
  readonly run: WorkflowRunRecord;
  readonly approvalStepRunId: string;
}

// Egy `running` futás egy döntésre váró jóváhagyás lépéssel.
function seedWaitingRun(database: DatabaseContext, name: string): SeededRun {
  const workflow = okOrThrow(database.workflows.createWorkflow({ name, description: null, providerId: null }));
  const run = okOrThrow(
    database.runs.startRun({
      workflowId: workflow.id,
      input: {},
      providerId: 'minimax',
      graphSnapshotDocument: {
        version: 1,
        sdkVersionPin: '0.0.0-teszt',
        workflow: { id: workflow.id, name, description: null },
        nodes: [],
        edges: [],
      },
    }),
  );
  okOrThrow(database.runs.markRunRunning(run.id));
  const approvalStepRunId = okOrThrow(
    database.stepRuns.createStepRun({
      runId: run.id,
      nodeId: `${name}-jov`,
      nodeType: 'human_approval',
      parentStepRunId: null,
      providerId: 'minimax',
      modelId: null,
      sessionMode: null,
      structuredOutputStrategy: null,
      subWorkflowRunId: null,
    }),
  ).id;
  okOrThrow(database.stepRuns.markStepRunning(approvalStepRunId));
  okOrThrow(
    database.approvals.requestApproval({
      runId: run.id,
      stepRunId: approvalStepRunId,
      title: 'döntés',
      body: 'szöveg',
      payload: {},
    }),
  );
  return { run: okOrThrow(database.runs.getRun(run.id)), approvalStepRunId };
}

const SUCCEEDED: Outcome<RunCompletion> = {
  kind: 'ok',
  value: { status: 'succeeded', errorKind: null, errorMessage: null, failedBranchCount: 0 },
};

function handleOf(run: WorkflowRunRecord): ActiveRunHandle & { readonly requestStop: ReturnType<typeof vi.fn> } {
  const requestStop = vi.fn();
  return {
    runId: run.id,
    rootRunId: run.rootRunId,
    workflowId: run.workflowId,
    completion: Promise.resolve(SUCCEEDED),
    requestStop,
    isStopRequested: () => requestStop.mock.calls.length > 0,
  };
}

function dependenciesOf(database: DatabaseContext, published: unknown[]): CancelActiveRunTreeDependencies {
  return {
    database,
    eventPublisher: {
      publish: (event) => {
        published.push(event);
      },
    },
    concurrencyGate: createConcurrencyGate(() => null),
    agentQueryRegistry: createAgentQueryRegistry(),
    approvalRegistry: createApprovalWaitRegistry(),
  };
}

describe('cancelActiveRunTree', () => {
  it('a megnevezett futásokat leállítja és a kapott zárással cancelled állapotba viszi, a jóváhagyásuk sorával együtt; más futás érintetlen', async () => {
    const database = okOrThrow(openDatabase(':memory:'));
    const target = seedWaitingRun(database, 'cel');
    const other = seedWaitingRun(database, 'masik');
    const published: unknown[] = [];
    const dependencies = dependenciesOf(database, published);
    const interrupt = vi.fn(() => Promise.resolve());
    dependencies.agentQueryRegistry.register(target.run.id, 'futo-lepes', {
      messages: { [Symbol.asyncIterator]: () => ({ next: () => Promise.resolve({ done: true, value: undefined }) }) },
      interrupt,
    });
    const handle = handleOf(target.run);

    const result = okOrThrow(
      await cancelActiveRunTree([handle], () => database.recovery.cancelRuns([target.run.id]), dependencies),
    );

    expect(result.cancelledRunIds).toStrictEqual([target.run.id]);
    expect(handle.requestStop).toHaveBeenCalledOnce();
    expect(interrupt).toHaveBeenCalledOnce();
    expect(okOrThrow(database.runs.getRun(target.run.id)).status).toBe('cancelled');
    expect(okOrThrow(database.stepRuns.getStepRun(target.approvalStepRunId)).status).toBe('cancelled');
    expect(okOrThrow(database.runs.getRun(other.run.id)).status).toBe('running');
    expect(okOrThrow(database.stepRuns.getStepRun(other.approvalStepRunId)).status).toBe('waiting_approval');
    expect(published).toStrictEqual([
      {
        kind: 'run_finished',
        runId: target.run.id,
        stepRunId: null,
        payload: { status: 'cancelled', errorKind: null, errorMessage: null, failedBranchCount: 0 },
      },
    ]);
  });

  it('a jóváhagyás sorok írásának hibájára a futásokat nem állítja le, és a zárást nem hívja', async () => {
    const database = okOrThrow(openDatabase(':memory:'));
    const target = seedWaitingRun(database, 'cel');
    const failingDatabase: DatabaseContext = {
      ...database,
      stepRuns: {
        ...database.stepRuns,
        listStepRuns: () => ({ kind: 'error', message: 'teszt: a lépés sorok nem olvashatók' }),
      },
    };
    const handle = handleOf(target.run);
    const closeInDatabase = vi.fn(() => database.recovery.cancelRuns([target.run.id]));

    const outcome = await cancelActiveRunTree([handle], closeInDatabase, dependenciesOf(failingDatabase, []));

    expect(outcome.kind === 'error' ? outcome.message : '').toBe('teszt: a lépés sorok nem olvashatók');
    expect(handle.requestStop).not.toHaveBeenCalled();
    expect(closeInDatabase).not.toHaveBeenCalled();
    expect(okOrThrow(database.runs.getRun(target.run.id)).status).toBe('running');
  });

  it('a DB zárás hibáját továbbadja, és élőben semmit nem ad ki', async () => {
    const database = okOrThrow(openDatabase(':memory:'));
    const target = seedWaitingRun(database, 'cel');
    const published: unknown[] = [];

    const outcome = await cancelActiveRunTree(
      [handleOf(target.run)],
      () => ({ kind: 'error', message: 'teszt: a zárás elbukott' }),
      dependenciesOf(database, published),
    );

    expect(outcome.kind === 'error' ? outcome.message : '').toBe('teszt: a zárás elbukott');
    expect(published).toStrictEqual([]);
  });
});
