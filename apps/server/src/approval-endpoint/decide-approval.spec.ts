/* eslint-disable unicorn/no-null -- a workflow/graph/approval teszt fixture nullázható mezői (description, providerId, onUnhandledError, parentStepRunId, modelId, sessionMode, structuredOutputStrategy, subWorkflowRunId, payload) valódi null értéket hordoznak, nem helyőrző undefined-et */
import { describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import { openDatabase, type DatabaseContext } from '@easter-workflow-builder/db';
import type { Engine } from '@easter-workflow-builder/engine';
import { createDecideApprovalHandler } from './decide-approval.ts';

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (!isOkOutcome(outcome)) {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

function openMemoryDatabase(): DatabaseContext {
  return okOrThrow(openDatabase(':memory:'));
}

function unused<TValue>(): Promise<TValue> {
  return Promise.reject(new Error('nem várt hívás'));
}

/**
 * A hamis motor `decideApproval`-ja a valós DB `approvals.decideApproval`
 * hívást futtatja le, ugyanúgy, ahogy a valós `Engine` teszi (SPEC-004): a
 * kezelő ezt a hívást csak közvetíti, a tesztnek a DB tényleges
 * állapotváltását kell látnia ahhoz, hogy a `getApprovalForStep` utáni
 * visszaolvasás értelmes legyen. Az `Engine.decideApproval` aláírása
 * `Promise<Outcome<void>>`-ot ad (`engine.ts`), ezért a DB hívás sikeres
 * `Outcome`-ját `void` értékre kell képezni.
 */
function buildFakeEngine(database: DatabaseContext, overrides: Partial<Engine> = {}): Engine {
  return {
    startRun: () => unused(),
    interruptRun: () => unused(),
    decideApproval: (input) => {
      const decided = database.approvals.decideApproval(input);
      return Promise.resolve(decided.kind === 'error' ? decided : { kind: 'ok', value: undefined });
    },
    restartRun: () => unused(),
    suggestedConcurrencyLimit: () => {
      throw new Error('nem várt hívás');
    },
    testProviderConnection: () => unused(),
    shutdown: () => unused(),
    ...overrides,
  };
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

describe('createDecideApprovalHandler', () => {
  it('sikeres döntésre a frissen eldöntött jóváhagyást adja vissza', async () => {
    const database = openMemoryDatabase();
    const { runId, stepRunId } = createTestRunAndWaitingStep(database);
    const approval = okOrThrow(
      database.approvals.requestApproval({ runId, stepRunId, title: 'Cím', body: 'Törzs', payload: {} }),
    );
    const handler = createDecideApprovalHandler(database, buildFakeEngine(database));

    const result = await handler({
      parameters: { approvalId: approval.id },
      query: new URLSearchParams(),
      body: { decision: 'approved' },
    });

    expect(result.kind).toBe('ok');
    expect(result.kind === 'ok' && result.value.body).toMatchObject({ decision: 'approved' });
  });

  it('nem függőben lévő approvalId-ra not_found hibát ad', async () => {
    const database = openMemoryDatabase();
    const handler = createDecideApprovalHandler(database, buildFakeEngine(database));

    const result = await handler({
      parameters: { approvalId: 'nincs-ilyen' },
      query: new URLSearchParams(),
      body: { decision: 'approved' },
    });

    expect(result.kind).toBe('error');
    expect(result.kind === 'error' && result.message).toContain('(not_found)');
  });

  it('érvénytelen kérés törzsre invalid_request hibát ad, a listát sem kérdezi le', async () => {
    const database = openMemoryDatabase();
    const handler = createDecideApprovalHandler(database, buildFakeEngine(database));

    const result = await handler({ parameters: { approvalId: 'x' }, query: new URLSearchParams(), body: {} });

    expect(result.kind).toBe('error');
  });

  it('a motor hibaágát változatlanul továbbadja', async () => {
    const database = openMemoryDatabase();
    const { runId, stepRunId } = createTestRunAndWaitingStep(database);
    const approval = okOrThrow(
      database.approvals.requestApproval({ runId, stepRunId, title: 'Cím', body: 'Törzs', payload: {} }),
    );
    const handler = createDecideApprovalHandler(
      database,
      buildFakeEngine(database, {
        decideApproval: () => Promise.resolve({ kind: 'error', message: 'hiba (internal).' }),
      }),
    );

    const result = await handler({
      parameters: { approvalId: approval.id },
      query: new URLSearchParams(),
      body: { decision: 'approved' },
    });

    expect(result.kind).toBe('error');
  });

  it('hiányzó approvalId útvonal paraméterre üres stringgel keres, not_found hibát ad', async () => {
    const database = openMemoryDatabase();
    const handler = createDecideApprovalHandler(database, buildFakeEngine(database));

    const result = await handler({ parameters: {}, query: new URLSearchParams(), body: { decision: 'approved' } });

    expect(result.kind).toBe('error');
  });

  it('a listPendingApprovals hibaágát változatlanul továbbadja (lezárt adatbázis kapcsolat)', async () => {
    const database = openMemoryDatabase();
    database.close();
    const handler = createDecideApprovalHandler(database, buildFakeEngine(database));

    const result = await handler({
      parameters: { approvalId: 'x' },
      query: new URLSearchParams(),
      body: { decision: 'approved' },
    });

    expect(result.kind).toBe('error');
  });

  it('a döntés utáni getApprovalForStep hibaágát változatlanul továbbadja', async () => {
    const database = openMemoryDatabase();
    const { runId, stepRunId } = createTestRunAndWaitingStep(database);
    const approval = okOrThrow(
      database.approvals.requestApproval({ runId, stepRunId, title: 'Cím', body: 'Törzs', payload: {} }),
    );
    const engine = buildFakeEngine(database);
    const databaseWithFailingReadback: DatabaseContext = {
      ...database,
      approvals: {
        ...database.approvals,
        getApprovalForStep: () => ({ kind: 'error', message: 'szimulált olvasási hiba (internal).' }),
      },
    };
    const handler = createDecideApprovalHandler(databaseWithFailingReadback, engine);

    const result = await handler({
      parameters: { approvalId: approval.id },
      query: new URLSearchParams(),
      body: { decision: 'approved' },
    });

    expect(result.kind).toBe('error');
  });
});
