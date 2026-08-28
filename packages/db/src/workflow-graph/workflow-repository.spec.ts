/* eslint-disable unicorn/no-null -- a `WorkflowRecord`/`NodeConfig` nullázható mezői (description, providerId, sourceHandle, ...) tárolt/visszaadott `null` értéket hordoznak, nem helyőrző `undefined`-et */
import SqliteDatabase from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { describeError, type Outcome } from '@easter-workflow-builder/core';
import { describe, expect, it } from 'vitest';
import { migrateDatabase } from '../migration/migrate-database.ts';
import { MIGRATIONS_FOLDER } from '../migration/migrations-folder.ts';
import { workflowTable } from './workflow.ts';
import { workflowNodeTable } from './workflow-node.ts';
import { workflowEdgeTable } from './workflow-edge.ts';
import type { NodeConfig } from './node-config.ts';
import { graphSnapshotTable } from '../graph-snapshot/graph-snapshot.ts';
import { GRAPH_DOCUMENT_VERSION, type GraphSnapshotDocument } from '../graph-snapshot/graph-snapshot-document.ts';
import { workflowRunTable } from '../workflow-run/workflow-run.ts';
import {
  createWorkflowRunRepository,
  type StartRunInput,
  type WorkflowRunRecord,
  type WorkflowRunRepository,
} from '../workflow-run/workflow-run-repository.ts';
import { createRunEventRepository, type RunEventRepository } from '../run-event/run-event-repository.ts';
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
  runs: WorkflowRunRepository;
  events: RunEventRepository;
} {
  const sqlite = new SqliteDatabase(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const database = drizzle(sqlite);
  migrateDatabase(database, MIGRATIONS_FOLDER);
  const transaction = makeTransaction(database);
  const repository = createWorkflowRepository(database, transaction);
  const runs = createWorkflowRunRepository(database, transaction);
  const events = createRunEventRepository(database, transaction);
  return { sqlite, database, repository, runs, events };
}

/**
 * Minimális, érvényes gráf pillanatkép dokumentum a `startRun` bemenetéhez.
 * A `name` argumentum tartalmi különbséget visz a dokumentumba, hogy két
 * hívás **szándékosan** azonos vagy **szándékosan** eltérő lenyomatot adjon,
 * a hívó választása szerint (a `summarizeDeletion`/`deleteWorkflow`
 * teszteknek mindkettő kell: a megosztott pillanatkép eset azonos `name`-mel
 * épül két különböző workflow alatt).
 */
function minimalDocument(workflowId: string, name: string): GraphSnapshotDocument {
  return {
    version: GRAPH_DOCUMENT_VERSION,
    sdkVersionPin: '0.0.0-test',
    workflow: { id: workflowId, name, description: null },
    nodes: [],
    edges: [],
  };
}

function startRunInput(workflowId: string, document: GraphSnapshotDocument): StartRunInput {
  return { workflowId, input: {}, providerId: 'minimax', graphSnapshotDocument: document };
}

/**
 * Kényelmi függvény, ami elindít egy futást és kicsomagolja az `Outcome`-ot;
 * ez tartja alacsonyan a beágyazási mélységet (`unicorn/max-nested-calls`,
 * max 3) azokon a hívási helyeken, amik különben
 * `okOrThrow(runs.startRun(startRunInput(id, minimalDocument(id, name))))`
 * alakban négy szintet érnének el.
 */
function startRun(
  runs: WorkflowRunRepository,
  workflowId: string,
  name: string,
  extra: Partial<StartRunInput> = {},
): WorkflowRunRecord {
  const document = minimalDocument(workflowId, name);
  const input: StartRunInput = { ...startRunInput(workflowId, document), ...extra };
  return okOrThrow(runs.startRun(input));
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
    it('nulla darabszámot ad egy futás nélküli workflow-ra', () => {
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

    it('a workflow-hoz tartozó futásokat SZÁMOLJA, saját snapshot sora árvává válik (nincs al-workflow)', () => {
      const { sqlite, repository, runs } = openRepository();
      const workflow = okOrThrow(repository.createWorkflow({ name: 'W', description: null, providerId: null }));
      startRun(runs, workflow.id, 'sole');

      // eventCount: 1, mert a `startRun` ugyanabban a tranzakcióban egy
      // `run_started` motor eseményt is ír (T-003-21).
      const summary = okOrThrow(repository.summarizeDeletion(workflow.id));
      expect(summary).toStrictEqual({ runCount: 1, eventCount: 1, snapshotCount: 1 });

      sqlite.close();
    });

    it('az eventCount a ténylegesen törlődő run_event sorok darabszáma, nem nulla (T-003-27)', () => {
      const { sqlite, repository, runs, events } = openRepository();
      const workflowA = okOrThrow(repository.createWorkflow({ name: 'A', description: null, providerId: null }));
      const workflowB = okOrThrow(repository.createWorkflow({ name: 'B', description: null, providerId: null }));

      // A workflow-a futása: a `startRun` `run_started` eseménye mellé még
      // két motor esemény, tehát összesen három sor tartozik hozzá.
      const runA = startRun(runs, workflowA.id, 'a');
      okOrThrow(events.appendEngineEvent({ runId: runA.id, stepRunId: null, kind: 'step_started', payload: {} }));
      okOrThrow(events.appendEngineEvent({ runId: runA.id, stepRunId: null, kind: 'step_finished', payload: {} }));

      // A workflow-b futása érintetlen marad, tehát az eseményei NEM
      // számítanak bele a workflow-a törlési összegzésébe.
      const runB = startRun(runs, workflowB.id, 'b');
      okOrThrow(events.appendEngineEvent({ runId: runB.id, stepRunId: null, kind: 'run_finished', payload: {} }));

      const summary = okOrThrow(repository.summarizeDeletion(workflowA.id));
      expect(summary).toStrictEqual({ runCount: 1, eventCount: 3, snapshotCount: 1 });

      sqlite.close();
    });

    it(
      'a gyökér futás root_run_id kaszkádja miatt a MÁSIK workflow-hoz tartozó al-workflow futását is beleszámolja ' +
        'a runCount-ba, a megosztott snapshot pedig NEM árva, ha egy másik, túlélő futás is hivatkozik rá (52. kritérium előkészítése)',
      () => {
        const { sqlite, repository, runs } = openRepository();
        const workflowA = okOrThrow(repository.createWorkflow({ name: 'A', description: null, providerId: null }));
        const workflowB = okOrThrow(repository.createWorkflow({ name: 'B', description: null, providerId: null }));

        // R1: workflow-a gyökér futása.
        const r1 = startRun(runs, workflowA.id, 'root-of-a');
        // R2: workflow-a hívja al-workflowként workflow-b-t; a dokumentum
        // tartalma (a workflow-b gráfja) MEGEGYEZIK R3-éval, tehát R2 és R3
        // ugyanarra a graph_snapshot sorra mutat (5.1 szekció: a dokumentum
        // a `workflow.id`-t hordozza, ami mindkettőnél workflow-b azonosítója).
        const r2 = startRun(runs, workflowB.id, 'shared', {
          parent: { rootRunId: r1.rootRunId, depth: r1.depth, workflowAncestry: r1.workflowAncestry },
        });
        // R3: workflow-b saját, önállóan indított futása, bájtra azonos
        // dokumentummal.
        const r3 = startRun(runs, workflowB.id, 'shared');
        expect(r2.graphSnapshotHash).toBe(r3.graphSnapshotHash);
        expect(r2.rootRunId).toBe(r1.id);
        expect(r3.rootRunId).toBe(r3.id);

        const summary = okOrThrow(repository.summarizeDeletion(workflowA.id));
        // runCount: R1 (direkt) + R2 (a root_run_id kaszkádja viszi, más
        // workflow-hoz tartozik) = 2. R3 NEM tartozik ide.
        expect(summary.runCount).toBe(2);
        // snapshotCount: R1 saját snapshotja árvává válna (csak R1
        // hivatkozik rá) = 1. A megosztott (R2/R3) snapshot NEM árva, mert
        // R3 túlél, tehát nem számít bele.
        expect(summary.snapshotCount).toBe(1);
        // eventCount: R1 és R2 `run_started` eseménye = 2. R3-é nem, mert R3
        // túléli a törlést - tehát az `eventCount` ugyanarra a kaszkáddal
        // bővített halmazra számol, mint a `runCount` (T-003-27).
        expect(summary.eventCount).toBe(2);

        sqlite.close();
      },
    );
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

    it('egyetlen futásra sem hivatkozott snapshot sort söpri, egyetlen hivatkozottat sem visz el (4.15 szekció)', () => {
      const { sqlite, database, repository, runs } = openRepository();
      const workflow = okOrThrow(repository.createWorkflow({ name: 'W', description: null, providerId: null }));
      const run = startRun(runs, workflow.id, 'sole');

      okOrThrow(repository.deleteWorkflow({ workflowId: workflow.id, acknowledgeIrreversible: true }));

      expect(database.select().from(workflowRunTable).all()).toStrictEqual([]);
      expect(
        database.select().from(graphSnapshotTable).where(eq(graphSnapshotTable.hash, run.graphSnapshotHash)).all(),
      ).toStrictEqual([]);

      sqlite.close();
    });

    it(
      'a gyökér futás törlése kaszkádban elviszi a más workflow-hoz tartozó al-workflow futását is, a ' +
        'megosztott snapshot sor viszont MEGMARAD, mert egy másik, túlélő futás még hivatkozik rá (52. kritérium)',
      () => {
        const { sqlite, database, repository, runs } = openRepository();
        const workflowA = okOrThrow(repository.createWorkflow({ name: 'A', description: null, providerId: null }));
        const workflowB = okOrThrow(repository.createWorkflow({ name: 'B', description: null, providerId: null }));

        const r1 = startRun(runs, workflowA.id, 'root-of-a');
        const r2 = startRun(runs, workflowB.id, 'shared', {
          parent: { rootRunId: r1.rootRunId, depth: r1.depth, workflowAncestry: r1.workflowAncestry },
        });
        const r3 = startRun(runs, workflowB.id, 'shared');
        const ownSnapshotHash = r1.graphSnapshotHash;
        const sharedSnapshotHash = r2.graphSnapshotHash;
        expect(sharedSnapshotHash).toBe(r3.graphSnapshotHash);

        okOrThrow(repository.deleteWorkflow({ workflowId: workflowA.id, acknowledgeIrreversible: true }));

        // R1 és R2 törlődött (kaszkád), R3 megmaradt (más workflow-hoz
        // tartozik, és nem a workflow-a fájának a része).
        const remainingRunIds = database
          .select({ id: workflowRunTable.id })
          .from(workflowRunTable)
          .all()
          .map((row) => row.id);
        expect(remainingRunIds).toStrictEqual([r3.id]);

        // A workflow-a saját (nem megosztott) snapshotja árva lett, a
        // söprés elvitte.
        expect(
          database.select().from(graphSnapshotTable).where(eq(graphSnapshotTable.hash, ownSnapshotHash)).all(),
        ).toStrictEqual([]);
        // A megosztott snapshot MEGMARADT, mert R3 még hivatkozik rá.
        expect(
          database.select().from(graphSnapshotTable).where(eq(graphSnapshotTable.hash, sharedSnapshotHash)).all(),
        ).toHaveLength(1);

        // workflow-b maga (és R3 workflowja) érintetlen.
        expect(database.select().from(workflowTable).where(eq(workflowTable.id, workflowB.id)).all()).toHaveLength(1);

        sqlite.close();
      },
    );
  });
});
