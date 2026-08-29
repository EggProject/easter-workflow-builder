/* eslint-disable unicorn/no-null -- a workflow/graph/step teszt fixture nullázható mezői (description, providerId, onUnhandledError, parentStepRunId, modelId, sessionMode, structuredOutputStrategy, subWorkflowRunId) valódi null értéket hordoznak, nem helyőrző undefined-et */
import { describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import { openDatabase, type DatabaseContext } from '@easter-workflow-builder/db';
import { createListStepRunsHandler } from './list-step-runs.ts';

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (!isOkOutcome(outcome)) {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

function openMemoryDatabase(): DatabaseContext {
  return okOrThrow(openDatabase(':memory:'));
}

function createTestRun(database: DatabaseContext): string {
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
  return run.id;
}

describe('createListStepRunsHandler', () => {
  it('a futás lépéseit időrendben, wire alakra képezve adja vissza', async () => {
    const database = openMemoryDatabase();
    const runId = createTestRun(database);
    okOrThrow(
      database.stepRuns.createStepRun({
        runId,
        nodeId: 'start-1',
        nodeType: 'start',
        parentStepRunId: null,
        providerId: 'claude-subscription',
        modelId: null,
        sessionMode: null,
        structuredOutputStrategy: null,
        subWorkflowRunId: null,
      }),
    );
    const handler = createListStepRunsHandler(database);

    const result = await handler({ parameters: { runId }, query: new URLSearchParams(), body: undefined });

    expect(result.kind).toBe('ok');
    expect(result.kind === 'ok' && result.value.body).toMatchObject([{ nodeId: 'start-1', runId }]);
  });

  it('nem létező futásra not_found hibát ad', async () => {
    const database = openMemoryDatabase();
    const handler = createListStepRunsHandler(database);

    const result = await handler({
      parameters: { runId: 'nincs-ilyen' },
      query: new URLSearchParams(),
      body: undefined,
    });

    expect(result.kind).toBe('error');
    expect(result.kind === 'error' && result.message).toContain('(not_found)');
  });
});
