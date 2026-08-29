/* eslint-disable unicorn/no-null -- a workflow/graph teszt fixture nullázható mezői (description, providerId, onUnhandledError) valódi null értéket hordoznak, nem helyőrző undefined-et */
import { describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import { openDatabase, type DatabaseContext } from '@easter-workflow-builder/db';
import { createListRunsHandler } from './list-runs.ts';

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (!isOkOutcome(outcome)) {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

function openMemoryDatabase(): DatabaseContext {
  return okOrThrow(openDatabase(':memory:'));
}

function createTestWorkflow(database: DatabaseContext): string {
  const workflow = okOrThrow(database.workflows.createWorkflow({ name: 'Teszt', description: null, providerId: null }));
  okOrThrow(
    database.workflows.replaceGraph(
      workflow.id,
      [
        {
          // A workflow_node.id a teljes adatbázisban egyedi (nem csak workflow-nkénti
          // hatókörben), ezért a workflow saját azonosítójából képzett, workflow-nkénti
          // egyedi node id kell, ha a tesztben több workflow is létrejön.
          id: `start-${workflow.id}`,
          label: 'Start',
          positionX: 0,
          positionY: 0,
          config: { type: 'start', inputFields: [], onUnhandledError: null },
        },
      ],
      [],
    ),
  );
  return workflow.id;
}

function startTestRun(database: DatabaseContext, workflowId: string): string {
  const graph = okOrThrow(database.workflows.readGraph(workflowId));
  const workflow = okOrThrow(database.workflows.getWorkflow(workflowId));
  const run = okOrThrow(
    database.runs.startRun({
      workflowId,
      input: {},
      providerId: 'claude-subscription',
      graphSnapshotDocument: {
        version: 1,
        sdkVersionPin: 'test',
        workflow: { id: workflowId, name: workflow.name, description: workflow.description },
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

describe('createListRunsHandler', () => {
  it('workflowId nélkül a teljes listát adja, wire alakra képezve', async () => {
    const database = openMemoryDatabase();
    const workflowId = createTestWorkflow(database);
    const runId = startTestRun(database, workflowId);
    const handler = createListRunsHandler(database);

    const result = await handler({ parameters: {}, query: new URLSearchParams({ limit: '10' }), body: undefined });

    expect(result.kind).toBe('ok');
    expect(result.kind === 'ok' && result.value.body).toMatchObject([{ id: runId, workflowId }]);
  });

  it('workflowId szerint szűkíti a listát', async () => {
    const database = openMemoryDatabase();
    const workflowIdA = createTestWorkflow(database);
    const workflowIdB = createTestWorkflow(database);
    startTestRun(database, workflowIdA);
    const runIdB = startTestRun(database, workflowIdB);
    const handler = createListRunsHandler(database);

    const result = await handler({
      parameters: {},
      query: new URLSearchParams({ limit: '10', workflowId: workflowIdB }),
      body: undefined,
    });

    expect(result.kind).toBe('ok');
    expect(result.kind === 'ok' && result.value.body).toMatchObject([{ id: runIdB }]);
  });

  it('limit szerint vágja a listát', async () => {
    const database = openMemoryDatabase();
    const workflowId = createTestWorkflow(database);
    startTestRun(database, workflowId);
    startTestRun(database, workflowId);
    const handler = createListRunsHandler(database);

    const result = await handler({ parameters: {}, query: new URLSearchParams({ limit: '1' }), body: undefined });

    expect(result.kind).toBe('ok');
    expect(result.kind === 'ok' && Array.isArray(result.value.body) && result.value.body).toHaveLength(1);
  });

  it('érvénytelen query paraméterre invalid_request hibát ad', async () => {
    const database = openMemoryDatabase();
    const handler = createListRunsHandler(database);

    const result = await handler({ parameters: {}, query: new URLSearchParams({ limit: '0' }), body: undefined });

    expect(result.kind).toBe('error');
  });

  it('a repository hibaágát változatlanul továbbadja (lezárt adatbázis kapcsolat)', async () => {
    const database = openMemoryDatabase();
    database.close();
    const handler = createListRunsHandler(database);

    const result = await handler({ parameters: {}, query: new URLSearchParams({ limit: '10' }), body: undefined });

    expect(result.kind).toBe('error');
  });
});
