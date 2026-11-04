/* eslint-disable unicorn/no-null -- a WorkflowRecord/CreateWorkflowInput description és providerId mezője valódi `T | null`, a tesztfixtúrák ezt a tárolt null értéket adják, nem helyőrzőt (SPEC-003 4.3) */
import { describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import { openDatabase, type DatabaseContext } from '@easter-workflow-builder/db';
import { createUpdateWorkflowHandler } from './update-workflow.ts';

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (!isOkOutcome(outcome)) {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

function openMemoryDatabase(): DatabaseContext {
  return okOrThrow(openDatabase(':memory:'));
}

describe('createUpdateWorkflowHandler', () => {
  it('csak a name mezőt küldve a többi mezőt érintetlenül hagyja', async () => {
    const database = openMemoryDatabase();
    const created = okOrThrow(
      database.workflows.createWorkflow({ name: 'Eredeti', description: 'leírás', providerId: 'minimax' }),
    );

    const handler = createUpdateWorkflowHandler(database);
    const result = await handler({
      parameters: { workflowId: created.id },
      query: new URLSearchParams(),
      body: { name: 'Új név' },
    });

    expect(result.kind).toBe('ok');
    expect(result.kind === 'ok' && result.value.body).toMatchObject({
      name: 'Új név',
      description: 'leírás',
      providerId: 'minimax',
    });
  });

  it('a builtinSkillsEnabled elhagyva a tárolt értéken marad, megadva (null is) érvényesül (SPEC-009 O-44)', async () => {
    const database = openMemoryDatabase();
    const created = okOrThrow(
      database.workflows.createWorkflow({
        name: 'Eredeti',
        description: null,
        providerId: null,
        builtinSkillsEnabled: false,
      }),
    );
    const handler = createUpdateWorkflowHandler(database);
    const update = async (body: Readonly<Record<string, unknown>>): Promise<unknown> => {
      const result = await handler({ parameters: { workflowId: created.id }, query: new URLSearchParams(), body });
      return result.kind === 'ok' ? result.value.body : result.message;
    };

    expect(await update({ name: 'Új név' })).toMatchObject({ builtinSkillsEnabled: false });
    expect(await update({ builtinSkillsEnabled: true })).toMatchObject({ builtinSkillsEnabled: true });
    expect(await update({ builtinSkillsEnabled: null })).toMatchObject({ builtinSkillsEnabled: null });
    expect(okOrThrow(database.workflows.getWorkflow(created.id)).builtinSkillsEnabled).toBeNull();
  });

  it('a description mező explicit null-ra állítását érvényesíti', async () => {
    const database = openMemoryDatabase();
    const created = okOrThrow(
      database.workflows.createWorkflow({ name: 'Eredeti', description: 'leírás', providerId: null }),
    );

    const handler = createUpdateWorkflowHandler(database);
    const result = await handler({
      parameters: { workflowId: created.id },
      query: new URLSearchParams(),
      body: { description: null },
    });

    expect(result.kind === 'ok' && result.value.body).toMatchObject({ name: 'Eredeti', description: null });
  });

  it('ismeretlen workflowId-ra not_found hibát ad', async () => {
    const handler = createUpdateWorkflowHandler(openMemoryDatabase());
    const result = await handler({
      parameters: { workflowId: 'nincs-ilyen' },
      query: new URLSearchParams(),
      body: { name: 'X' },
    });
    expect(result.kind).toBe('error');
    expect(result.kind === 'error' && result.message).toContain('(not_found)');
  });

  it('sémának nem megfelelő törzsre invalid_request hibát ad', async () => {
    const handler = createUpdateWorkflowHandler(openMemoryDatabase());
    const result = await handler({
      parameters: { workflowId: 'akármi' },
      query: new URLSearchParams(),
      body: { name: 7 },
    });
    expect(result.kind).toBe('error');
    expect(result.kind === 'error' && result.message).toContain('(invalid_request)');
  });

  it('hiányzó workflowId paraméterre is not_found hibát ad, nem dob kivételt', async () => {
    const handler = createUpdateWorkflowHandler(openMemoryDatabase());
    const result = await handler({ parameters: {}, query: new URLSearchParams(), body: { name: 'X' } });
    expect(result.kind).toBe('error');
  });

  it('az updateWorkflow hibáját továbbadja, ha az adatbázis a getWorkflow és az updateWorkflow között bezárul', async () => {
    const database = openMemoryDatabase();
    const created = okOrThrow(
      database.workflows.createWorkflow({ name: 'Eredeti', description: null, providerId: null }),
    );

    const racyDatabase: DatabaseContext = {
      ...database,
      workflows: {
        ...database.workflows,
        getWorkflow: (workflowId: string) => {
          const result = database.workflows.getWorkflow(workflowId);
          if (result.kind === 'ok') {
            database.close();
          }
          return result;
        },
      },
    };

    const handler = createUpdateWorkflowHandler(racyDatabase);
    const result = await handler({
      parameters: { workflowId: created.id },
      query: new URLSearchParams(),
      body: { name: 'Új név' },
    });
    expect(result.kind).toBe('error');
  });

  it('ismeretlen providerId értékre invalid_request hibát ad', async () => {
    const database = openMemoryDatabase();
    const created = okOrThrow(
      database.workflows.createWorkflow({ name: 'Eredeti', description: null, providerId: null }),
    );
    const handler = createUpdateWorkflowHandler(database);
    const result = await handler({
      parameters: { workflowId: created.id },
      query: new URLSearchParams(),
      body: { providerId: 'nincs-ilyen-provider' },
    });
    expect(result.kind).toBe('error');
    expect(result.kind === 'error' && result.message).toContain('(invalid_request)');
  });
});
