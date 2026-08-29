/* eslint-disable unicorn/no-null -- a WorkflowRecord/CreateWorkflowInput/WorkflowEdgeInput több mezője valódi `T | null`, a tesztfixtúrák ezt a tárolt null értéket adják, nem helyőrzőt (SPEC-003 4.3) */
import { describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import { openDatabase, type DatabaseContext, type WorkflowEdgeInput, type WorkflowNodeInput } from '@easter-workflow-builder/db';
import { createReplaceWorkflowGraphHandler } from './replace-workflow-graph.ts';

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (!isOkOutcome(outcome)) {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

function openMemoryDatabase(): DatabaseContext {
  return okOrThrow(openDatabase(':memory:'));
}

function startNodeConfig(): Record<string, unknown> {
  return { type: 'start', inputFields: [], onUnhandledError: null };
}

describe('createReplaceWorkflowGraphHandler', () => {
  it('érvényes gráfot cserél, és a friss dokumentumot adja vissza', async () => {
    const database = openMemoryDatabase();
    const created = okOrThrow(
      database.workflows.createWorkflow({ name: 'Teszt', description: null, providerId: null }),
    );

    const handler = createReplaceWorkflowGraphHandler(database);
    const result = await handler({
      parameters: { workflowId: created.id },
      query: new URLSearchParams(),
      body: {
        nodes: [{ id: 'n1', type: 'start', label: 'Start', positionX: 0, positionY: 0, config: startNodeConfig() }],
        edges: [],
      },
    });

    expect(result.kind).toBe('ok');
    expect(result.kind === 'ok' && result.value.body).toMatchObject({
      nodes: [{ id: 'n1', label: 'Start' }],
      edges: [],
    });
  });

  it('sémának nem megfelelő törzsre invalid_request hibát ad', async () => {
    const handler = createReplaceWorkflowGraphHandler(openMemoryDatabase());
    const result = await handler({ parameters: { workflowId: 'akármi' }, query: new URLSearchParams(), body: { nodes: [] } });
    expect(result.kind).toBe('error');
    expect(result.kind === 'error' && result.message).toContain('(invalid_request)');
  });

  it('ismeretlen workflowId-ra not_found hibát ad', async () => {
    const handler = createReplaceWorkflowGraphHandler(openMemoryDatabase());
    const result = await handler({
      parameters: { workflowId: 'nincs-ilyen' },
      query: new URLSearchParams(),
      body: { nodes: [], edges: [] },
    });
    expect(result.kind).toBe('error');
    expect(result.kind === 'error' && result.message).toContain('(not_found)');
  });

  it('érvénytelen node config-ra malformed_node_config hibát ad', async () => {
    const database = openMemoryDatabase();
    const created = okOrThrow(
      database.workflows.createWorkflow({ name: 'Teszt', description: null, providerId: null }),
    );

    const handler = createReplaceWorkflowGraphHandler(database);
    const result = await handler({
      parameters: { workflowId: created.id },
      query: new URLSearchParams(),
      body: {
        nodes: [{ id: 'n1', type: 'start', label: 'Start', positionX: 0, positionY: 0, config: { type: 'start' } }],
        edges: [],
      },
    });
    expect(result.kind).toBe('error');
    expect(result.kind === 'error' && result.message).toContain('(malformed_node_config)');
  });

  it('nem létező node-ra mutató él idegenkulcs-sértést ad, ami conflict hibaosztályra képződik', async () => {
    const database = openMemoryDatabase();
    const created = okOrThrow(
      database.workflows.createWorkflow({ name: 'Teszt', description: null, providerId: null }),
    );

    const handler = createReplaceWorkflowGraphHandler(database);
    const result = await handler({
      parameters: { workflowId: created.id },
      query: new URLSearchParams(),
      body: {
        nodes: [{ id: 'n1', type: 'start', label: 'Start', positionX: 0, positionY: 0, config: startNodeConfig() }],
        edges: [
          {
            id: 'e1',
            sourceNodeId: 'n1',
            targetNodeId: 'nincs-ilyen-node',
            sourceHandle: null,
            targetHandle: null,
            branchKey: null,
          },
        ],
      },
    });
    expect(result.kind).toBe('error');
    expect(result.kind === 'error' && result.message).toContain('(foreign_key_violation)');
  });

  it('hiányzó workflowId paraméterre is not_found hibát ad, nem dob kivételt', async () => {
    const handler = createReplaceWorkflowGraphHandler(openMemoryDatabase());
    const result = await handler({ parameters: {}, query: new URLSearchParams(), body: { nodes: [], edges: [] } });
    expect(result.kind).toBe('error');
  });

  it('a readGraph hibáját továbbadja, ha az adatbázis a replaceGraph és a readGraph között bezárul', async () => {
    const database = openMemoryDatabase();
    const created = okOrThrow(
      database.workflows.createWorkflow({ name: 'Teszt', description: null, providerId: null }),
    );

    const racyDatabase: DatabaseContext = {
      ...database,
      workflows: {
        ...database.workflows,
        replaceGraph: (workflowId: string, nodes: readonly WorkflowNodeInput[], edges: readonly WorkflowEdgeInput[]) => {
          const result = database.workflows.replaceGraph(workflowId, nodes, edges);
          if (result.kind === 'ok') {
            database.close();
          }
          return result;
        },
      },
    };

    const handler = createReplaceWorkflowGraphHandler(racyDatabase);
    const result = await handler({
      parameters: { workflowId: created.id },
      query: new URLSearchParams(),
      body: { nodes: [], edges: [] },
    });
    expect(result.kind).toBe('error');
  });
});
