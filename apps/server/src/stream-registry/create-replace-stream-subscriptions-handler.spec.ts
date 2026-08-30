/* eslint-disable unicorn/no-null -- a workflow/graph teszt fixture nullázható mezői (description, providerId, onUnhandledError) valódi null értéket hordoznak, nem helyőrző undefined-et */
import { describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import { openDatabase, type DatabaseContext } from '@easter-workflow-builder/db';
import { createRandomUuidIdGenerator } from '../engine-assembly/create-random-uuid-id-generator.ts';
import { createStreamRegistry } from './create-stream-registry.ts';
import { createReplaceStreamSubscriptionsHandler } from './create-replace-stream-subscriptions-handler.ts';

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

describe('createReplaceStreamSubscriptionsHandler', () => {
  it('létező futásra teljes cserét végez, és a stream-registry állapotát adja vissza', async () => {
    const database = openMemoryDatabase();
    const runId = createTestRun(database);
    const registry = createStreamRegistry(createRandomUuidIdGenerator());
    const handler = createReplaceStreamSubscriptionsHandler(database, registry);

    const result = await handler({
      parameters: { streamId: 's1' },
      query: new URLSearchParams(),
      body: { runs: [{ runId, fromEventId: 0, replayLimit: 10 }] },
    });

    expect(result).toStrictEqual({
      kind: 'ok',
      value: { status: 200, body: { streamId: 's1', subscriptions: [{ runId, fromEventId: 0, replayLimit: 10 }] } },
    });
    expect(registry.getSubscriptions('s1')).toStrictEqual([{ runId, fromEventId: 0, replayLimit: 10 }]);
  });

  it('nem létező runId-ra not_found hibát ad, és nem módosítja a nyilvántartást', async () => {
    const database = openMemoryDatabase();
    const registry = createStreamRegistry(createRandomUuidIdGenerator());
    const handler = createReplaceStreamSubscriptionsHandler(database, registry);

    const result = await handler({
      parameters: { streamId: 's1' },
      query: new URLSearchParams(),
      body: { runs: [{ runId: 'nincs-ilyen', fromEventId: 0, replayLimit: 10 }] },
    });

    expect(result.kind).toBe('error');
    expect(result.kind === 'error' && result.message).toContain('(not_found)');
    expect(registry.getSubscriptions('s1')).toStrictEqual([]);
  });

  it('érvénytelen kérés törzsre invalid_request hibát ad', async () => {
    const database = openMemoryDatabase();
    const registry = createStreamRegistry(createRandomUuidIdGenerator());
    const handler = createReplaceStreamSubscriptionsHandler(database, registry);

    const result = await handler({ parameters: { streamId: 's1' }, query: new URLSearchParams(), body: {} });

    expect(result.kind).toBe('error');
  });

  it('hiányzó streamId útvonal paraméterre üres stringgel cserél', async () => {
    const database = openMemoryDatabase();
    const registry = createStreamRegistry(createRandomUuidIdGenerator());
    const handler = createReplaceStreamSubscriptionsHandler(database, registry);

    const result = await handler({ parameters: {}, query: new URLSearchParams(), body: { runs: [] } });

    expect(result).toStrictEqual({ kind: 'ok', value: { status: 200, body: { streamId: '', subscriptions: [] } } });
  });
});
