/* eslint-disable unicorn/no-null -- a workflow/graph/step teszt fixture nullázható mezői (description, providerId, onUnhandledError, parentStepRunId, modelId, sessionMode, structuredOutputStrategy, subWorkflowRunId) valódi null értéket hordoznak, nem helyőrző undefined-et */
import { describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import { openDatabase, type DatabaseContext } from '@easter-workflow-builder/db';
import { createReadRunEventsHandler } from './read-run-events.ts';

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

function appendEvent(database: DatabaseContext, runId: string, stepRunId: string | null): number {
  const appended = okOrThrow(
    database.events.appendEngineEvent({ runId, stepRunId, kind: 'run_started', payload: { note: 'teszt' } }),
  );
  return appended.eventId;
}

describe('createReadRunEventsHandler', () => {
  it('afterEventId szerint, wire alakra képezve adja vissza az eseményeket', async () => {
    const database = openMemoryDatabase();
    const runId = createTestRun(database);
    // A createTestRun (database.runs.startRun) már beszúr egy run_started eseményt
    // (1. azonosítóval), ezért az afterEventId itt 1-től indul, hogy csak az itt
    // hozzáadott két eseményt lássuk.
    appendEvent(database, runId, null);
    appendEvent(database, runId, null);
    const handler = createReadRunEventsHandler(database);

    const result = await handler({
      parameters: { runId },
      query: new URLSearchParams({ afterEventId: '1', limit: '10' }),
      body: undefined,
    });

    expect(result.kind).toBe('ok');
    expect(result.kind === 'ok' && result.value.body).toMatchObject({ events: [{}, {}] });
  });

  it('stepRunId szerint szűr, afterEventId nélkül', async () => {
    const database = openMemoryDatabase();
    const runId = createTestRun(database);
    const step = okOrThrow(
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
    appendEvent(database, runId, step.id);
    appendEvent(database, runId, null);
    const handler = createReadRunEventsHandler(database);

    const result = await handler({
      parameters: { runId },
      query: new URLSearchParams({ stepRunId: step.id, limit: '10' }),
      body: undefined,
    });

    expect(result.kind).toBe('ok');
    expect(result.kind === 'ok' && result.value.body).toMatchObject({ events: [{ stepRunId: step.id }] });
  });

  it('nem létező futásra not_found hibát ad', async () => {
    const database = openMemoryDatabase();
    const handler = createReadRunEventsHandler(database);

    const result = await handler({
      parameters: { runId: 'nincs-ilyen' },
      query: new URLSearchParams({ afterEventId: '0', limit: '10' }),
      body: undefined,
    });

    expect(result.kind).toBe('error');
    expect(result.kind === 'error' && result.message).toContain('(not_found)');
  });

  it('érvénytelen query paraméterre invalid_request hibát ad', async () => {
    const database = openMemoryDatabase();
    const runId = createTestRun(database);
    const handler = createReadRunEventsHandler(database);

    const result = await handler({ parameters: { runId }, query: new URLSearchParams(), body: undefined });

    expect(result.kind).toBe('error');
  });
});
