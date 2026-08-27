/* eslint-disable unicorn/no-null -- a `WorkflowRecord`/`NodeConfig` nullázható mezői (description, providerId, sourceHandle, ...) tárolt/visszaadott `null` értéket hordoznak, nem helyőrző `undefined`-et */
import SqliteDatabase from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { describeError, type Outcome } from '@easter-workflow-builder/core';
import { describe, expect, it } from 'vitest';
import { migrateDatabase } from '../migration/migrate-database.ts';
import { MIGRATIONS_FOLDER } from '../migration/migrations-folder.ts';
import { workflowTable } from './workflow.ts';
import { workflowNodeTable } from './workflow-node.ts';
import { workflowEdgeTable } from './workflow-edge.ts';
import type { NodeConfig } from './node-config.ts';
import {
  createWorkflowRepository,
  type WorkflowEdgeInput,
  type WorkflowNodeInput,
  type WorkflowRepository,
} from './workflow-repository.ts';

/**
 * Ugyanaz a tranzakció minta, mint `open-database.ts`-ben (SPEC-003 9.1
 * szekció): a `.spec.ts` fájl a `createWorkflowRepository`-t közvetlenül
 * teszteli, nem az `openDatabase` kompozíción keresztül, hogy a korrupt
 * adat teszteknél legyen közvetlen `database` hozzáférés a nyers
 * `workflowTable`/`workflowNodeTable` beszúráshoz (typeguard megkerülése).
 */
class TransactionRollback extends Error {}

function makeTransaction(database: BetterSQLite3Database) {
  return function transaction<TValue>(work: () => Outcome<TValue>): Outcome<TValue> {
    try {
      const value = database.transaction((): TValue => {
        const result = work();
        if (result.kind === 'error') {
          throw new TransactionRollback(result.message);
        }
        return result.value;
      });
      return { kind: 'ok', value };
    } catch (error) {
      if (error instanceof TransactionRollback) {
        return { kind: 'error', message: error.message };
      }
      return { kind: 'error', message: describeError(error) };
    }
  };
}

function openRepository(): {
  sqlite: SqliteDatabase.Database;
  database: BetterSQLite3Database;
  repository: WorkflowRepository;
} {
  const sqlite = new SqliteDatabase(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const database = drizzle(sqlite);
  migrateDatabase(database, MIGRATIONS_FOLDER);
  const repository = createWorkflowRepository(database, makeTransaction(database));
  return { sqlite, database, repository };
}

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (outcome.kind !== 'ok') {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

function errorOrThrow<TValue>(outcome: Outcome<TValue>): string {
  if (outcome.kind !== 'error') {
    throw new Error('hibaágat vártunk');
  }
  return outcome.message;
}

const startConfig: NodeConfig = { type: 'start', inputFields: [] };

function twoNodesOneEdge(): { nodes: readonly WorkflowNodeInput[]; edges: readonly WorkflowEdgeInput[] } {
  const nodes: readonly WorkflowNodeInput[] = [
    { id: 'node-a', label: 'A', positionX: 0, positionY: 0, config: startConfig },
    {
      id: 'node-b',
      label: 'B',
      positionX: 1,
      positionY: 1,
      config: { type: 'branch', expression: 'true', branches: [], defaultBranchKey: null },
    },
  ];
  const edges: readonly WorkflowEdgeInput[] = [
    {
      id: 'edge-1',
      sourceNodeId: 'node-a',
      targetNodeId: 'node-b',
      sourceHandle: 'out',
      targetHandle: 'in',
      branchKey: null,
    },
  ];
  return { nodes, edges };
}

describe('createWorkflowRepository', () => {
  describe('createWorkflow / getWorkflow', () => {
    it('létrehoz egy workflow-t, generált id-vel és időbélyeggel', () => {
      const { sqlite, repository } = openRepository();

      const created = okOrThrow(
        repository.createWorkflow({ name: 'Első workflow', description: 'Leírás', providerId: 'minimax' }),
      );
      expect(created.id).toHaveLength(36);
      expect(created.name).toBe('Első workflow');
      expect(created.description).toBe('Leírás');
      expect(created.providerId).toBe('minimax');
      expect(created.createdAtMs).toStrictEqual(created.updatedAtMs);

      const fetched = okOrThrow(repository.getWorkflow(created.id));
      expect(fetched).toStrictEqual(created);

      sqlite.close();
    });

    it('a description és a providerId null maradhat', () => {
      const { sqlite, repository } = openRepository();

      const created = okOrThrow(repository.createWorkflow({ name: 'Minimál', description: null, providerId: null }));
      expect(created.description).toBeNull();
      expect(created.providerId).toBeNull();

      sqlite.close();
    });

    it('not_found hibaágat ad ismeretlen workflowId-ra', () => {
      const { sqlite, repository } = openRepository();

      const message = errorOrThrow(repository.getWorkflow('nincs-ilyen'));
      expect(message).toContain('not_found');

      sqlite.close();
    });

    it('invalid_provider_id hibaágat ad, ha a tárolt provider_id nem érvényes ProviderId (korrupt adat)', () => {
      const { sqlite, database, repository } = openRepository();

      // A nyers Drizzle tábla `providerId` oszlopa a séma szintjén sima
      // `string | null` (nincs `$type<ProviderId>()`), tehát ide közvetlenül
      // beszúrható egy érvénytelen érték, szimulálva a "nincs DB szintű CHECK"
      // (SPEC-003 4.1) korrupt adat esetét, amit a `createWorkflow` típusos
      // bemenete a repository nyilvános felületén keresztül sosem engedne be.
      database
        .insert(workflowTable)
        .values({
          id: 'corrupt-1',
          name: 'Korrupt',
          description: null,
          providerId: 'nem-letezo-provider',
          createdAtMs: new Date(0),
          updatedAtMs: new Date(0),
        })
        .run();

      const message = errorOrThrow(repository.getWorkflow('corrupt-1'));
      expect(message).toContain('invalid_provider_id');

      sqlite.close();
    });
  });

  describe('updateWorkflow', () => {
    it('frissíti a mezőket, az updatedAtMs változik, a createdAtMs nem', () => {
      const { sqlite, repository } = openRepository();
      const created = okOrThrow(repository.createWorkflow({ name: 'Régi', description: null, providerId: null }));

      const updated = okOrThrow(
        repository.updateWorkflow(created.id, {
          name: 'Új név',
          description: 'Új leírás',
          providerId: 'claude-subscription',
        }),
      );
      expect(updated.id).toBe(created.id);
      expect(updated.name).toBe('Új név');
      expect(updated.description).toBe('Új leírás');
      expect(updated.providerId).toBe('claude-subscription');
      expect(updated.createdAtMs).toStrictEqual(created.createdAtMs);
      expect(updated.updatedAtMs.getTime()).toBeGreaterThanOrEqual(created.updatedAtMs.getTime());

      const fetched = okOrThrow(repository.getWorkflow(created.id));
      expect(fetched).toStrictEqual(updated);

      sqlite.close();
    });

    it('not_found hibaágat ad, ha a workflow nem létezik', () => {
      const { sqlite, repository } = openRepository();

      const message = errorOrThrow(
        repository.updateWorkflow('nincs-ilyen', { name: 'X', description: null, providerId: null }),
      );
      expect(message).toContain('not_found');

      sqlite.close();
    });
  });

  describe('listWorkflows', () => {
    it('üres listát ad, ha nincs workflow', () => {
      const { sqlite, repository } = openRepository();
      expect(okOrThrow(repository.listWorkflows())).toStrictEqual([]);
      sqlite.close();
    });

    it('updated_at_ms szerint csökkenő sorrendben adja vissza a workflow-kat', () => {
      const { sqlite, database, repository } = openRepository();

      // Közvetlen, kontrollált időbélyeggel beszúrva (nem a repository által
      // generált, aktuális idővel), hogy a rendezés teszt ne a fal-óra
      // pontosságán múljon (két gyors egymás utáni hívás ugyanabba a
      // ezredmásodpercbe eshetne, és instabillá tenné a várt sorrendet).
      database
        .insert(workflowTable)
        .values([
          {
            id: 'w-older',
            name: 'Régebbi',
            description: null,
            providerId: null,
            createdAtMs: new Date(0),
            updatedAtMs: new Date(1000),
          },
          {
            id: 'w-newer',
            name: 'Újabb',
            description: null,
            providerId: null,
            createdAtMs: new Date(0),
            updatedAtMs: new Date(2000),
          },
        ])
        .run();

      const list = okOrThrow(repository.listWorkflows());
      expect(list.map((workflow) => workflow.id)).toStrictEqual(['w-newer', 'w-older']);

      sqlite.close();
    });

    it('invalid_provider_id hibaágat ad, ha a listában szereplő bármelyik sor korrupt', () => {
      const { sqlite, database, repository } = openRepository();
      okOrThrow(repository.createWorkflow({ name: 'Rendes', description: null, providerId: null }));
      database
        .insert(workflowTable)
        .values({
          id: 'corrupt-2',
          name: 'Korrupt',
          description: null,
          providerId: 'nem-letezo-provider',
          createdAtMs: new Date(0),
          updatedAtMs: new Date(0),
        })
        .run();

      const message = errorOrThrow(repository.listWorkflows());
      expect(message).toContain('invalid_provider_id');

      sqlite.close();
    });
  });

  describe('replaceGraph / readGraph', () => {
    it('beírja a teljes gráfot, a readGraph típusosan (NodeConfig) adja vissza', () => {
      const { sqlite, repository } = openRepository();
      const workflow = okOrThrow(repository.createWorkflow({ name: 'Gráf', description: null, providerId: null }));
      const { nodes, edges } = twoNodesOneEdge();

      okOrThrow(repository.replaceGraph(workflow.id, nodes, edges));

      const graph = okOrThrow(repository.readGraph(workflow.id));
      expect(graph.nodes).toHaveLength(2);
      expect(graph.edges).toHaveLength(1);
      const nodeA = graph.nodes.find((node) => node.id === 'node-a');
      expect(nodeA?.type).toBe('start');
      expect(nodeA?.config).toStrictEqual(startConfig);
      const [edge] = graph.edges;
      expect(edge?.createdAtMs).toBeInstanceOf(Date);
      expect(edge).toMatchObject({
        id: 'edge-1',
        sourceNodeId: 'node-a',
        targetNodeId: 'node-b',
        sourceHandle: 'out',
        targetHandle: 'in',
        branchKey: null,
      });

      sqlite.close();
    });

    it('egy második replaceGraph hívás lecseréli az előző gráfot (nincs node/él szintű CRUD)', () => {
      const { sqlite, repository } = openRepository();
      const workflow = okOrThrow(repository.createWorkflow({ name: 'Gráf', description: null, providerId: null }));
      const { nodes, edges } = twoNodesOneEdge();
      okOrThrow(repository.replaceGraph(workflow.id, nodes, edges));

      okOrThrow(
        repository.replaceGraph(
          workflow.id,
          [{ id: 'node-c', label: 'C', positionX: 5, positionY: 5, config: startConfig }],
          [],
        ),
      );

      const graph = okOrThrow(repository.readGraph(workflow.id));
      expect(graph.nodes.map((node) => node.id)).toStrictEqual(['node-c']);
      expect(graph.edges).toStrictEqual([]);

      sqlite.close();
    });

    it('üres node/él listával teljesen kiüríti a gráfot', () => {
      const { sqlite, repository } = openRepository();
      const workflow = okOrThrow(repository.createWorkflow({ name: 'Gráf', description: null, providerId: null }));
      const { nodes, edges } = twoNodesOneEdge();
      okOrThrow(repository.replaceGraph(workflow.id, nodes, edges));

      okOrThrow(repository.replaceGraph(workflow.id, [], []));

      const graph = okOrThrow(repository.readGraph(workflow.id));
      expect(graph).toStrictEqual({ nodes: [], edges: [] });

      sqlite.close();
    });

    it('readGraph üres gráfot ad egy frissen létrehozott workflow-ra', () => {
      const { sqlite, repository } = openRepository();
      const workflow = okOrThrow(repository.createWorkflow({ name: 'Üres', description: null, providerId: null }));

      const graph = okOrThrow(repository.readGraph(workflow.id));
      expect(graph).toStrictEqual({ nodes: [], edges: [] });

      sqlite.close();
    });

    it('hibaágat ad és visszagörget, ha egy él nem létező node-ra hivatkozik (idegen kulcs sértés)', () => {
      const { sqlite, repository } = openRepository();
      const workflow = okOrThrow(repository.createWorkflow({ name: 'Gráf', description: null, providerId: null }));

      const outcome = repository.replaceGraph(
        workflow.id,
        [{ id: 'node-a', label: 'A', positionX: 0, positionY: 0, config: startConfig }],
        [
          {
            id: 'edge-x',
            sourceNodeId: 'node-a',
            targetNodeId: 'nincs-ilyen-node',
            sourceHandle: null,
            targetHandle: null,
            branchKey: null,
          },
        ],
      );
      expect(outcome.kind).toBe('error');

      // A tranzakció visszagörgetése miatt a node sem íródott be.
      const graph = okOrThrow(repository.readGraph(workflow.id));
      expect(graph).toStrictEqual({ nodes: [], edges: [] });

      sqlite.close();
    });

    it('corrupt_node_config hibaágat ad, ha egy tárolt node config nem érvényes NodeConfig (korrupt adat)', () => {
      const { sqlite, database, repository } = openRepository();
      const workflow = okOrThrow(repository.createWorkflow({ name: 'Gráf', description: null, providerId: null }));
      database
        .insert(workflowNodeTable)
        .values({
          id: 'corrupt-node',
          workflowId: workflow.id,
          type: 'start',
          label: 'Korrupt',
          positionX: 0,
          positionY: 0,
          config: { type: 'start' /* hiányzó inputFields, érvénytelen alak */ },
          createdAtMs: new Date(0),
          updatedAtMs: new Date(0),
        })
        .run();

      const message = errorOrThrow(repository.readGraph(workflow.id));
      expect(message).toContain('corrupt_node_config');

      sqlite.close();
    });
  });

  describe('summarizeDeletion', () => {
    it('nulla darabszámot ad meglévő workflow-ra (nyitott pont, T-003-16 zárja le)', () => {
      const { sqlite, repository } = openRepository();
      const workflow = okOrThrow(repository.createWorkflow({ name: 'W', description: null, providerId: null }));

      const summary = okOrThrow(repository.summarizeDeletion(workflow.id));
      expect(summary).toStrictEqual({ runCount: 0, eventCount: 0, snapshotCount: 0 });

      sqlite.close();
    });

    it('not_found hibaágat ad ismeretlen workflowId-ra', () => {
      const { sqlite, repository } = openRepository();
      const message = errorOrThrow(repository.summarizeDeletion('nincs-ilyen'));
      expect(message).toContain('not_found');
      sqlite.close();
    });
  });

  describe('deleteWorkflow', () => {
    it('törli a workflow-t, és a kaszkád a node/él sorokat is elviszi', () => {
      const { sqlite, database, repository } = openRepository();
      const workflow = okOrThrow(repository.createWorkflow({ name: 'Törlendő', description: null, providerId: null }));
      okOrThrow(
        repository.replaceGraph(
          workflow.id,
          [{ id: 'node-a', label: 'A', positionX: 0, positionY: 0, config: startConfig }],
          [],
        ),
      );

      const outcome = repository.deleteWorkflow({ workflowId: workflow.id, acknowledgeIrreversible: true });
      expect(outcome).toStrictEqual({ kind: 'ok', value: undefined });

      expect(database.select().from(workflowTable).all()).toStrictEqual([]);
      expect(database.select().from(workflowNodeTable).all()).toStrictEqual([]);
      expect(database.select().from(workflowEdgeTable).all()).toStrictEqual([]);

      sqlite.close();
    });

    it('not_found hibaágat ad ismeretlen workflowId-ra', () => {
      const { sqlite, repository } = openRepository();
      const message = errorOrThrow(
        repository.deleteWorkflow({ workflowId: 'nincs-ilyen', acknowledgeIrreversible: true }),
      );
      expect(message).toContain('not_found');
      sqlite.close();
    });
  });
});
