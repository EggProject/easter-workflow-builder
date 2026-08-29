/* eslint-disable unicorn/no-null -- a WorkflowRecord/CreateWorkflowInput description és providerId mezője valódi `T | null`, a tesztfixtúrák ezt a tárolt null értéket adják, nem helyőrzőt (SPEC-003 4.3) */
import { describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import { openDatabase, type DatabaseContext } from '@easter-workflow-builder/db';
import { createDeleteWorkflowHandler } from './delete-workflow.ts';

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (!isOkOutcome(outcome)) {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

function openMemoryDatabase(): DatabaseContext {
  return okOrThrow(openDatabase(':memory:'));
}

describe('createDeleteWorkflowHandler', () => {
  it('érvényes kérésre töröl, és DeletionSummary-t ad', async () => {
    const database = openMemoryDatabase();
    const created = okOrThrow(
      database.workflows.createWorkflow({ name: 'Teszt', description: null, providerId: null }),
    );

    const handler = createDeleteWorkflowHandler(database);
    const result = await handler({
      parameters: { workflowId: created.id },
      query: new URLSearchParams(),
      body: { acknowledgeIrreversible: true },
    });

    expect(result).toStrictEqual({
      kind: 'ok',
      value: { status: 200, body: { runCount: 0, eventCount: 0, snapshotCount: 0 } },
    });

    const afterDelete = database.workflows.getWorkflow(created.id);
    expect(afterDelete.kind).toBe('error');
  });

  it('hiányzó törzsre invalid_request hibát ad, és nem töröl', async () => {
    const database = openMemoryDatabase();
    const created = okOrThrow(
      database.workflows.createWorkflow({ name: 'Teszt', description: null, providerId: null }),
    );

    const handler = createDeleteWorkflowHandler(database);
    const result = await handler({ parameters: { workflowId: created.id }, query: new URLSearchParams(), body: undefined });

    expect(result.kind).toBe('error');
    expect(result.kind === 'error' && result.message).toContain('(invalid_request)');
    expect(database.workflows.getWorkflow(created.id).kind).toBe('ok');
  });

  it('acknowledgeIrreversible: false esetén invalid_request hibát ad', async () => {
    const handler = createDeleteWorkflowHandler(openMemoryDatabase());
    const result = await handler({
      parameters: { workflowId: 'akármi' },
      query: new URLSearchParams(),
      body: { acknowledgeIrreversible: false },
    });
    expect(result.kind).toBe('error');
    expect(result.kind === 'error' && result.message).toContain('(invalid_request)');
  });

  it('ismeretlen workflowId-ra not_found hibát ad', async () => {
    const handler = createDeleteWorkflowHandler(openMemoryDatabase());
    const result = await handler({
      parameters: { workflowId: 'nincs-ilyen' },
      query: new URLSearchParams(),
      body: { acknowledgeIrreversible: true },
    });
    expect(result.kind).toBe('error');
    expect(result.kind === 'error' && result.message).toContain('(not_found)');
  });

  it('hiányzó workflowId paraméterre is not_found hibát ad, nem dob kivételt', async () => {
    const handler = createDeleteWorkflowHandler(openMemoryDatabase());
    const result = await handler({ parameters: {}, query: new URLSearchParams(), body: { acknowledgeIrreversible: true } });
    expect(result.kind).toBe('error');
  });

  it('a deleteWorkflow hibáját továbbadja, ha az adatbázis a summarizeDeletion és a deleteWorkflow között bezárul', async () => {
    const database = openMemoryDatabase();
    const created = okOrThrow(
      database.workflows.createWorkflow({ name: 'Teszt', description: null, providerId: null }),
    );

    const racyDatabase: DatabaseContext = {
      ...database,
      workflows: {
        ...database.workflows,
        summarizeDeletion: (workflowId: string) => {
          const result = database.workflows.summarizeDeletion(workflowId);
          if (result.kind === 'ok') {
            database.close();
          }
          return result;
        },
      },
    };

    const handler = createDeleteWorkflowHandler(racyDatabase);
    const result = await handler({
      parameters: { workflowId: created.id },
      query: new URLSearchParams(),
      body: { acknowledgeIrreversible: true },
    });
    expect(result.kind).toBe('error');
  });
});
