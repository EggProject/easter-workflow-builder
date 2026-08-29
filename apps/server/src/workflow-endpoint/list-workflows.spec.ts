/* eslint-disable unicorn/no-null -- a WorkflowRecord/CreateWorkflowInput description és providerId mezője valódi `T | null`, a tesztfixtúrák ezt a tárolt null értéket adják, nem helyőrzőt (SPEC-003 4.3) */
import { describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import { openDatabase, type DatabaseContext } from '@easter-workflow-builder/db';
import { createListWorkflowsHandler } from './list-workflows.ts';

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (!isOkOutcome(outcome)) {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

function openMemoryDatabase(): DatabaseContext {
  return okOrThrow(openDatabase(':memory:'));
}

describe('createListWorkflowsHandler', () => {
  it('üres adatbázisra üres listát ad, 200 státusszal', async () => {
    const handler = createListWorkflowsHandler(openMemoryDatabase());
    const result = await handler({ parameters: {}, query: new URLSearchParams({ limit: '10' }), body: undefined });
    expect(result).toStrictEqual({ kind: 'ok', value: { status: 200, body: [] } });
  });

  it('a WorkflowDetail alakra képzett listát adja, a limit szerint levágva', async () => {
    const database = openMemoryDatabase();
    okOrThrow(database.workflows.createWorkflow({ name: 'A', description: null, providerId: null }));
    okOrThrow(database.workflows.createWorkflow({ name: 'B', description: null, providerId: null }));
    okOrThrow(database.workflows.createWorkflow({ name: 'C', description: null, providerId: null }));

    const handler = createListWorkflowsHandler(database);
    const result = await handler({ parameters: {}, query: new URLSearchParams({ limit: '2' }), body: undefined });

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.value.body).toHaveLength(2);
    }
  });

  it('hiányzó limit query paraméterre invalid_request hibát ad', async () => {
    const handler = createListWorkflowsHandler(openMemoryDatabase());
    const result = await handler({ parameters: {}, query: new URLSearchParams(), body: undefined });
    expect(result.kind).toBe('error');
    expect(result.kind === 'error' && result.message).toContain('(invalid_request)');
  });

  it('érvénytelen (nem pozitív) limit query paraméterre invalid_request hibát ad', async () => {
    const handler = createListWorkflowsHandler(openMemoryDatabase());
    const result = await handler({ parameters: {}, query: new URLSearchParams({ limit: '0' }), body: undefined });
    expect(result.kind).toBe('error');
    expect(result.kind === 'error' && result.message).toContain('(invalid_request)');
  });

  it('a listWorkflows hibáját továbbadja, ha az adatbázis kapcsolat már zárva van', async () => {
    const database = openMemoryDatabase();
    database.close();

    const handler = createListWorkflowsHandler(database);
    const result = await handler({ parameters: {}, query: new URLSearchParams({ limit: '10' }), body: undefined });
    expect(result.kind).toBe('error');
  });
});
