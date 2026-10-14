/* eslint-disable unicorn/no-null -- a WorkflowRecord/CreateWorkflowInput description és providerId mezője valódi `T | null`, a tesztfixtúrák ezt a tárolt null értéket adják, nem helyőrzőt (SPEC-003 4.3) */
import { describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import { openDatabase, type DatabaseContext } from '@easter-workflow-builder/db';
import { WorkflowGraphDocumentSchema } from '@easter-workflow-builder/protocol';
import { isRecord } from '@easter-workflow-builder/typeguards';
import { createCreateWorkflowHandler } from './create-workflow.ts';
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

const CREATE_REQUEST_BODY = { name: 'Teszt', description: null, providerId: null };

async function createWorkflowAndReturnId(database: DatabaseContext): Promise<string> {
  const result = await createCreateWorkflowHandler(database)({
    parameters: {},
    query: new URLSearchParams(),
    body: CREATE_REQUEST_BODY,
  });
  if (result.kind !== 'ok' || !isRecord(result.value.body) || typeof result.value.body['id'] !== 'string') {
    throw new Error('a létrehozás nem adott WorkflowDetail alakú választ');
  }
  return result.value.body['id'];
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

  describe('a Start csomópont a létrehozáskor (SPEC-008 5.8, O-20, 96. kritérium)', () => {
    it('a létrehozás után a gráf pontosan egy Start csomópontot tartalmaz, él nélkül', async () => {
      const database = openMemoryDatabase();

      const workflowId = await createWorkflowAndReturnId(database);

      const graph = okOrThrow(database.workflows.readGraph(workflowId));
      expect(graph.edges).toStrictEqual([]);
      expect(graph.nodes).toHaveLength(1);
      expect(graph.nodes[0]).toMatchObject({
        type: 'start',
        label: '',
        positionX: 0,
        positionY: 0,
      });
      expect(graph.nodes[0]?.config).toStrictEqual({ type: 'start', inputFields: [], onUnhandledError: null });
    });

    it('a Start csomópont a GET .../graph olvasó sémán is átmegy', async () => {
      const database = openMemoryDatabase();
      const workflowId = await createWorkflowAndReturnId(database);

      const result = await createReadWorkflowGraphHandler(database)({
        parameters: { workflowId },
        query: new URLSearchParams(),
        body: undefined,
      });

      const parsed = result.kind === 'ok' ? WorkflowGraphDocumentSchema.safeParse(result.value.body) : undefined;
      expect(parsed?.success).toBe(true);
      expect(parsed?.success && parsed.data.nodes.map((node) => node.config.type)).toStrictEqual(['start']);
    });

    it('két egymás utáni létrehozás két különböző csomópont azonosítót ad', async () => {
      const database = openMemoryDatabase();

      const firstWorkflowId = await createWorkflowAndReturnId(database);
      const secondWorkflowId = await createWorkflowAndReturnId(database);

      const firstNodeId = okOrThrow(database.workflows.readGraph(firstWorkflowId)).nodes[0]?.id;
      const secondNodeId = okOrThrow(database.workflows.readGraph(secondWorkflowId)).nodes[0]?.id;
      expect(firstWorkflowId).not.toBe(secondWorkflowId);
      expect(typeof firstNodeId).toBe('string');
      expect(typeof secondNodeId).toBe('string');
      expect(firstNodeId).not.toBe(secondNodeId);
    });

    it('REGRESSZIÓ: ha a replaceGraph a gráf kiírása után hibaágat ad, a workflow sor és a Start sem marad meg (a tranzakció visszagörgetett, M-113)', async () => {
      const database = openMemoryDatabase();
      const attemptedWorkflowIds: string[] = [];
      const failingDatabase: DatabaseContext = {
        ...database,
        workflows: {
          ...database.workflows,
          replaceGraph: (workflowId, nodes, edges) => {
            attemptedWorkflowIds.push(workflowId);
            okOrThrow(database.workflows.replaceGraph(workflowId, nodes, edges));
            return { kind: 'error', message: 'teszt: a gráf kiírása hibázott' };
          },
        },
      };

      const result = await createCreateWorkflowHandler(failingDatabase)({
        parameters: {},
        query: new URLSearchParams(),
        body: CREATE_REQUEST_BODY,
      });

      expect(result).toStrictEqual({ kind: 'error', message: 'teszt: a gráf kiírása hibázott' });
      expect(okOrThrow(database.workflows.listWorkflows())).toStrictEqual([]);
      expect(attemptedWorkflowIds).toHaveLength(1);
      expect(okOrThrow(database.workflows.readGraph(attemptedWorkflowIds[0] ?? '')).nodes).toStrictEqual([]);
    });

    it('a createWorkflow tranzakción belüli hibáját továbbadja, és a replaceGraph hívás elmarad', async () => {
      const database = openMemoryDatabase();
      let replaceGraphCallCount = 0;
      const failingDatabase: DatabaseContext = {
        ...database,
        workflows: {
          ...database.workflows,
          createWorkflow: () => ({ kind: 'error', message: 'teszt: a létrehozás hibázott' }),
          replaceGraph: (workflowId, nodes, edges) => {
            replaceGraphCallCount += 1;
            return database.workflows.replaceGraph(workflowId, nodes, edges);
          },
        },
      };

      const result = await createCreateWorkflowHandler(failingDatabase)({
        parameters: {},
        query: new URLSearchParams(),
        body: CREATE_REQUEST_BODY,
      });

      expect(result).toStrictEqual({ kind: 'error', message: 'teszt: a létrehozás hibázott' });
      expect(replaceGraphCallCount).toBe(0);
      expect(okOrThrow(database.workflows.listWorkflows())).toStrictEqual([]);
    });
  });
});
