/* eslint-disable unicorn/no-null -- a workflow/graph/step teszt fixture nullázható mezői (description, providerId, onUnhandledError, parentStepRunId, modelId, sessionMode, structuredOutputStrategy, subWorkflowRunId, payload) valódi null értéket hordoznak, nem helyőrző undefined-et */
import { describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import { openDatabase, type DatabaseContext } from '@easter-workflow-builder/db';
import { createListPendingApprovalsHandler } from './list-pending-approvals.ts';

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (!isOkOutcome(outcome)) {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

function openMemoryDatabase(): DatabaseContext {
  return okOrThrow(openDatabase(':memory:'));
}

function createTestRunAndWaitingStep(database: DatabaseContext): { runId: string; stepRunId: string } {
  const workflow = okOrThrow(database.workflows.createWorkflow({ name: 'Teszt', description: null, providerId: null }));
  okOrThrow(
    database.workflows.replaceGraph(
      workflow.id,
      [
        {
          id: 'start-1',
          label: 'Start',
          positionX: 0,
          positionY: 0,
          config: { type: 'start', inputFields: [], onUnhandledError: null },
        },
      ],
      [],
    ),
  );
  const graph = okOrThrow(database.workflows.readGraph(workflow.id));
  const run = okOrThrow(
    database.runs.startRun({
      workflowId: workflow.id,
      input: {},
      providerId: 'claude-subscription',
      graphSnapshotDocument: {
        version: 1,
        sdkVersionPin: 'test',
        workflow: { id: workflow.id, name: workflow.name, description: workflow.description },
        nodes: graph.nodes.map((node) => ({
          id: node.id,
          type: 'start',
          label: node.label,
          position: { x: node.positionX, y: node.positionY },
          config: node.config,
          effectiveProviderId: 'claude-subscription',
        })),
        edges: [],
      },
    }),
  );
  const step = okOrThrow(
    database.stepRuns.createStepRun({
      runId: run.id,
      nodeId: 'start-1',
      nodeType: 'human_approval',
      parentStepRunId: null,
      providerId: 'claude-subscription',
      modelId: null,
      sessionMode: null,
      structuredOutputStrategy: null,
      subWorkflowRunId: null,
    }),
  );
  okOrThrow(database.stepRuns.markStepRunning(step.id));
  return { runId: run.id, stepRunId: step.id };
}

describe('createListPendingApprovalsHandler', () => {
  it('a függőben lévő jóváhagyásokat wire alakra képezve adja vissza', async () => {
    const database = openMemoryDatabase();
    const { runId, stepRunId } = createTestRunAndWaitingStep(database);
    okOrThrow(database.approvals.requestApproval({ runId, stepRunId, title: 'Cím', body: 'Törzs', payload: {} }));
    const handler = createListPendingApprovalsHandler(database);

    const result = await handler({ parameters: {}, query: new URLSearchParams(), body: undefined });

    expect(result.kind).toBe('ok');
    expect(result.kind === 'ok' && result.value.body).toMatchObject([{ stepRunId }]);
  });

  it('üres listára üres tömböt ad', async () => {
    const database = openMemoryDatabase();
    const handler = createListPendingApprovalsHandler(database);

    const result = await handler({ parameters: {}, query: new URLSearchParams(), body: undefined });

    expect(result).toStrictEqual({ kind: 'ok', value: { status: 200, body: [] } });
  });
});
