/* eslint-disable unicorn/no-null -- a WorkflowRecord/CreateWorkflowInput description és providerId mezője valódi `T | null`, a tesztfixtúrák ezt a tárolt null értéket adják, nem helyőrzőt (SPEC-003 4.3) */
import { describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import { openDatabase, type DatabaseContext } from '@easter-workflow-builder/db';
import { createCreateWorkflowHandler } from './create-workflow.ts';

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (!isOkOutcome(outcome)) {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

function openMemoryDatabase(): DatabaseContext {
  return okOrThrow(openDatabase(':memory:'));
}

describe('createCreateWorkflowHandler', () => {
  it('érvényes kérésre WorkflowDetail alakú választ ad, 200 státusszal', async () => {
    const handler = createCreateWorkflowHandler(openMemoryDatabase());
    const result = await handler({
      parameters: {},
      query: new URLSearchParams(),
      body: { name: 'Teszt', description: 'leírás', providerId: 'minimax' },
    });

    expect(result.kind).toBe('ok');
    expect(result.kind === 'ok' && result.value.status).toBe(200);
    expect(result.kind === 'ok' && result.value.body).toMatchObject({ name: 'Teszt', providerId: 'minimax' });
  });

  it('null providerId-vel is elfogadja a kérést', async () => {
    const handler = createCreateWorkflowHandler(openMemoryDatabase());
    const result = await handler({
      parameters: {},
      query: new URLSearchParams(),
      body: { name: 'Teszt', description: null, providerId: null },
    });
    expect(result.kind).toBe('ok');
  });

  it('sémának nem megfelelő törzsre invalid_request hibát ad', async () => {
    const handler = createCreateWorkflowHandler(openMemoryDatabase());
    const result = await handler({ parameters: {}, query: new URLSearchParams(), body: { name: 'Teszt' } });
    expect(result.kind).toBe('error');
    expect(result.kind === 'error' && result.message).toContain('(invalid_request)');
  });

  it('a createWorkflow hibáját továbbadja, ha az adatbázis kapcsolat már zárva van', async () => {
    const database = openMemoryDatabase();
    database.close();

    const handler = createCreateWorkflowHandler(database);
    const result = await handler({
      parameters: {},
      query: new URLSearchParams(),
      body: { name: 'Teszt', description: null, providerId: null },
    });
    expect(result.kind).toBe('error');
  });

  it('ismeretlen providerId értékre invalid_request hibát ad', async () => {
    const handler = createCreateWorkflowHandler(openMemoryDatabase());
    const result = await handler({
      parameters: {},
      query: new URLSearchParams(),
      body: { name: 'Teszt', description: null, providerId: 'nincs-ilyen-provider' },
    });
    expect(result.kind).toBe('error');
    expect(result.kind === 'error' && result.message).toContain('(invalid_request)');
  });
});
