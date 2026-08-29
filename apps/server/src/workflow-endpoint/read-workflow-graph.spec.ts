/* eslint-disable unicorn/no-null -- a WorkflowRecord/CreateWorkflowInput description és providerId mezője valódi `T | null`, a tesztfixtúrák ezt a tárolt null értéket adják, nem helyőrzőt (SPEC-003 4.3) */
import { describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import { openDatabase, type DatabaseContext } from '@easter-workflow-builder/db';
import { createReadWorkflowGraphHandler } from './read-workflow-graph.ts';

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (!isOkOutcome(outcome)) {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

function openMemoryDatabase(): DatabaseContext {
  return okOrThrow(openDatabase(':memory:'));
}

describe('createReadWorkflowGraphHandler', () => {
  it('létező, üres gráfú workflow-ra üres node/él listát ad', async () => {
    const database = openMemoryDatabase();
    const created = okOrThrow(
      database.workflows.createWorkflow({ name: 'Teszt', description: null, providerId: null }),
    );

    const handler = createReadWorkflowGraphHandler(database);
    const result = await handler({ parameters: { workflowId: created.id }, query: new URLSearchParams(), body: undefined });

    expect(result).toStrictEqual({ kind: 'ok', value: { status: 200, body: { nodes: [], edges: [] } } });
  });

  it('ismeretlen workflowId-ra not_found hibát ad', async () => {
    const handler = createReadWorkflowGraphHandler(openMemoryDatabase());
    const result = await handler({ parameters: { workflowId: 'nincs-ilyen' }, query: new URLSearchParams(), body: undefined });
    expect(result.kind).toBe('error');
    expect(result.kind === 'error' && result.message).toContain('(not_found)');
  });

  it('hiányzó workflowId paraméterre is not_found hibát ad, nem dob kivételt', async () => {
    const handler = createReadWorkflowGraphHandler(openMemoryDatabase());
    const result = await handler({ parameters: {}, query: new URLSearchParams(), body: undefined });
    expect(result.kind).toBe('error');
  });

  it('a readGraph hibáját továbbadja, ha az adatbázis a getWorkflow és a readGraph között bezárul', async () => {
    const database = openMemoryDatabase();
    const created = okOrThrow(
      database.workflows.createWorkflow({ name: 'Teszt', description: null, providerId: null }),
    );

    // Ugyanaz a minta, mint a packages/engine begin-step-run.spec.ts-ben: a
    // valódi repository egyik metódusát dekoráljuk, hogy a két hívás közé
    // egy tényleges, önálló hibaforrást (bezárt kapcsolat) ékeljünk.
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

    const handler = createReadWorkflowGraphHandler(racyDatabase);
    const result = await handler({ parameters: { workflowId: created.id }, query: new URLSearchParams(), body: undefined });

    expect(result.kind).toBe('error');
  });
});
