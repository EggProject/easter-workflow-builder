/* eslint-disable unicorn/no-null -- a WorkflowRecord/CreateWorkflowInput description és providerId mezője valódi `T | null`, a tesztfixtúrák ezt a tárolt null értéket adják, nem helyőrzőt (SPEC-003 4.3) */
import { describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import { openDatabase, type DatabaseContext } from '@easter-workflow-builder/db';
import { createGetWorkflowHandler } from './get-workflow.ts';

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (!isOkOutcome(outcome)) {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

function openMemoryDatabase(): DatabaseContext {
  return okOrThrow(openDatabase(':memory:'));
}

describe('createGetWorkflowHandler', () => {
  it('létező workflow-ra WorkflowDetail alakú választ ad', async () => {
    const database = openMemoryDatabase();
    const created = okOrThrow(
      database.workflows.createWorkflow({ name: 'Teszt', description: null, providerId: null }),
    );

    const handler = createGetWorkflowHandler(database);
    const result = await handler({
      parameters: { workflowId: created.id },
      query: new URLSearchParams(),
      body: undefined,
    });

    expect(result).toStrictEqual({
      kind: 'ok',
      value: {
        status: 200,
        body: {
          id: created.id,
          name: 'Teszt',
          description: null,
          providerId: null,
          createdAtMs: created.createdAtMs.getTime(),
          updatedAtMs: created.updatedAtMs.getTime(),
        },
      },
    });
  });

  it('ismeretlen workflowId-ra not_found hibaosztályú hibát ad', async () => {
    const handler = createGetWorkflowHandler(openMemoryDatabase());
    const result = await handler({
      parameters: { workflowId: 'nincs-ilyen' },
      query: new URLSearchParams(),
      body: undefined,
    });
    expect(result.kind).toBe('error');
    expect(result.kind === 'error' && result.message).toContain('(not_found)');
  });

  it('hiányzó workflowId paraméterre is not_found hibát ad, nem dob kivételt', async () => {
    const handler = createGetWorkflowHandler(openMemoryDatabase());
    const result = await handler({ parameters: {}, query: new URLSearchParams(), body: undefined });
    expect(result.kind).toBe('error');
  });
});
