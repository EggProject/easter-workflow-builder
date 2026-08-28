import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray, notInArray, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { isProviderId, type ProviderId } from '@easter-workflow-builder/provider-capability';
import type { Outcome } from '@easter-workflow-builder/core';
import { workflowTable } from './workflow.ts';
import { workflowNodeTable } from './workflow-node.ts';
import { workflowEdgeTable } from './workflow-edge.ts';
import type { NodeConfig } from './node-config.ts';
import type { NodeType } from './node-type.ts';
import { isNodeConfig } from './is-node-config.ts';
import { workflowRunTable } from '../workflow-run/workflow-run.ts';
import { runEventTable } from '../run-event/run-event.ts';

/**
 * Ugyanaz az aláírás, mint a `DatabaseContext.transaction` (SPEC-003 9.1
 * szekció). Nem onnan importáljuk, hogy elkerüljük a kört (`database-context.ts`
 * a `WorkflowRepository` típust importálja innen).
 */
type TransactionFunction = <TValue>(work: () => Outcome<TValue>) => Outcome<TValue>;

export interface WorkflowRecord {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly providerId: ProviderId | null;
  readonly createdAtMs: Date;
  readonly updatedAtMs: Date;
}

export interface CreateWorkflowInput {
  readonly name: string;
  readonly description: string | null;
  readonly providerId: ProviderId | null;
}

export interface UpdateWorkflowInput {
  readonly name: string;
  readonly description: string | null;
  readonly providerId: ProviderId | null;
}

/**
 * `replaceGraph` bemeneti node alakja. Nincs külön `type` mező: a `config`
 * unió diszkriminátora (`config.type`) már hordozza, a `workflow_node.type`
 * oszlopot a repository ebből tölti (node-config.ts: "az oszlop és a config
 * ugyanazt a `NodeType` értéket hordozza").
 */
export interface WorkflowNodeInput {
  readonly id: string;
  readonly label: string;
  readonly positionX: number;
  readonly positionY: number;
  readonly config: NodeConfig;
}

export interface WorkflowNodeRecord {
  readonly id: string;
  readonly type: NodeType;
  readonly label: string;
  readonly positionX: number;
  readonly positionY: number;
  readonly config: NodeConfig;
  readonly createdAtMs: Date;
  readonly updatedAtMs: Date;
}

export interface WorkflowEdgeInput {
  readonly id: string;
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly sourceHandle: string | null;
  readonly targetHandle: string | null;
  readonly branchKey: string | null;
}

export interface WorkflowEdgeRecord extends WorkflowEdgeInput {
  readonly createdAtMs: Date;
}

export interface WorkflowGraph {
  readonly nodes: readonly WorkflowNodeRecord[];
  readonly edges: readonly WorkflowEdgeRecord[];
}

/**
 * A törlés előtti megerősítő párbeszédhez (SPEC-003 4.15 szekció, 28.
 * kritérium): mi veszne el, ha a hívó ténylegesen törli a workflow-t.
 *
 * Mind a három mező ténylegesen törlődő sorok darabszáma: a `runCount` és a
 * `snapshotCount` a T-003-16, az `eventCount` a T-003-27 óta. A számítás
 * részleteit a `summarizeDeletion` dokumentációja írja le.
 */
export interface DeletionSummary {
  readonly runCount: number;
  readonly eventCount: number;
  readonly snapshotCount: number;
}

/**
 * A `true` LITERÁL típus (nem `boolean`) kényszeríti ki fordítási időben az
 * `acknowledgeIrreversible: true` jelenlétét (SPEC-003 9.2, 28. kritérium):
 * `acknowledgeIrreversible: false` vagy a mező hiánya nem fordul le.
 */
export interface DeleteWorkflowInput {
  readonly workflowId: string;
  readonly acknowledgeIrreversible: true;
}

export interface WorkflowRepository {
  createWorkflow(input: CreateWorkflowInput): Outcome<WorkflowRecord>;
  updateWorkflow(workflowId: string, patch: UpdateWorkflowInput): Outcome<WorkflowRecord>;
  getWorkflow(workflowId: string): Outcome<WorkflowRecord>;
  listWorkflows(): Outcome<readonly WorkflowRecord[]>;
  replaceGraph(
    workflowId: string,
    nodes: readonly WorkflowNodeInput[],
    edges: readonly WorkflowEdgeInput[],
  ): Outcome<void>;
  readGraph(workflowId: string): Outcome<WorkflowGraph>;
  summarizeDeletion(workflowId: string): Outcome<DeletionSummary>;
  deleteWorkflow(input: DeleteWorkflowInput): Outcome<void>;
}

function notFoundMessage(workflowId: string): string {
  return `A(z) "${workflowId}" azonosítójú workflow nem található (not_found).`;
}

/**
 * A `provider_id` oszlopon nincs DB szintű `CHECK` (SPEC-003 4.1): az
 * érvényességet olvasáskor a `ProviderId` typeguard adja. Íráskor erre nincs
 * szükség, mert a `CreateWorkflowInput`/`UpdateWorkflowInput` mezője már
 * TypeScript szinten `ProviderId | null`, a hívó felelőssége. Nem a
 * `createWorkflowRepository` zárványában él, mert nem használ onnan semmit
 * (csak a paraméterét), a `unicorn/consistent-function-scoping` szabály
 * szerint a legkülső hatókörben a helye.
 */
function toWorkflowRecord(row: typeof workflowTable.$inferSelect): Outcome<WorkflowRecord> {
  const providerId = row.providerId;
  if (providerId !== null && !isProviderId(providerId)) {
    return {
      kind: 'error',
      message: `A(z) "${row.id}" workflow provider_id mezője érvénytelen: "${providerId}" (invalid_provider_id).`,
    };
  }
  return {
    kind: 'ok',
    value: {
      id: row.id,
      name: row.name,
      description: row.description,
      providerId,
      createdAtMs: row.createdAtMs,
      updatedAtMs: row.updatedAtMs,
    },
  };
}

/**
 * `packages/db/CLAUDE.md` "Outcome hibaosztály konvenció" szerint: a
 * hibaosztály neve szó szerint, zárójelben áll az emberi nyelvű üzenetben.
 */
export function createWorkflowRepository(
  database: BetterSQLite3Database,
  transaction: TransactionFunction,
): WorkflowRepository {
  function createWorkflow(input: CreateWorkflowInput): Outcome<WorkflowRecord> {
    return transaction(() => {
      const now = new Date();
      const row = {
        id: randomUUID(),
        name: input.name,
        description: input.description,
        providerId: input.providerId,
        createdAtMs: now,
        updatedAtMs: now,
      };
      database.insert(workflowTable).values(row).run();
      return { kind: 'ok', value: row };
    });
  }

  function updateWorkflow(workflowId: string, patch: UpdateWorkflowInput): Outcome<WorkflowRecord> {
    return transaction(() => {
      const existing = database.select().from(workflowTable).where(eq(workflowTable.id, workflowId)).get();
      if (existing === undefined) {
        return { kind: 'error', message: notFoundMessage(workflowId) };
      }
      const updatedAtMs = new Date();
      database
        .update(workflowTable)
        .set({ name: patch.name, description: patch.description, providerId: patch.providerId, updatedAtMs })
        .where(eq(workflowTable.id, workflowId))
        .run();
      return {
        kind: 'ok',
        value: {
          id: workflowId,
          name: patch.name,
          description: patch.description,
          providerId: patch.providerId,
          createdAtMs: existing.createdAtMs,
          updatedAtMs,
        },
      };
    });
  }

  function getWorkflow(workflowId: string): Outcome<WorkflowRecord> {
    return transaction(() => {
      const row = database.select().from(workflowTable).where(eq(workflowTable.id, workflowId)).get();
      if (row === undefined) {
        return { kind: 'error', message: notFoundMessage(workflowId) };
      }
      return toWorkflowRecord(row);
    });
  }

  /**
   * A `workflow_updated_at_idx` (4.1 szekció) az egyetlen index a táblán, és
   * a lista nézetnek a legutóbb módosított workflow a leghasznosabb elöl,
   * ezért csökkenő sorrendben rendez.
   */
  function listWorkflows(): Outcome<readonly WorkflowRecord[]> {
    return transaction(() => {
      const rows = database.select().from(workflowTable).orderBy(desc(workflowTable.updatedAtMs)).all();
      const records: WorkflowRecord[] = [];
      for (const row of rows) {
        const outcome = toWorkflowRecord(row);
        if (outcome.kind === 'error') {
          return outcome;
        }
        records.push(outcome.value);
      }
      return { kind: 'ok', value: records };
    });
  }

  /**
   * A teljes gráfot cseréli, nincs node/él szintű CRUD (SPEC-003 9.2). A
   * bemenet már típusos `NodeConfig`, nincs mit typeguarddal szűkíteni
   * íráskor (9.4 szekció, a `readGraph` unknown-ját ez különbözteti meg).
   */
  function replaceGraph(
    workflowId: string,
    nodes: readonly WorkflowNodeInput[],
    edges: readonly WorkflowEdgeInput[],
  ): Outcome<void> {
    return transaction(() => {
      database.delete(workflowEdgeTable).where(eq(workflowEdgeTable.workflowId, workflowId)).run();
      database.delete(workflowNodeTable).where(eq(workflowNodeTable.workflowId, workflowId)).run();

      const now = new Date();

      if (nodes.length > 0) {
        database
          .insert(workflowNodeTable)
          .values(
            nodes.map((node) => ({
              id: node.id,
              workflowId,
              type: node.config.type,
              label: node.label,
              positionX: node.positionX,
              positionY: node.positionY,
              config: node.config,
              createdAtMs: now,
              updatedAtMs: now,
            })),
          )
          .run();
      }

      if (edges.length > 0) {
        database
          .insert(workflowEdgeTable)
          .values(
            edges.map((edge) => ({
              id: edge.id,
              workflowId,
              sourceNodeId: edge.sourceNodeId,
              targetNodeId: edge.targetNodeId,
              sourceHandle: edge.sourceHandle,
              targetHandle: edge.targetHandle,
              branchKey: edge.branchKey,
              createdAtMs: now,
            })),
          )
          .run();
      }

      return { kind: 'ok', value: undefined };
    });
  }

  /**
   * A `config` oszlop a DB-ben `unknown`; az `isNodeConfig` guard szűkíti.
   * Ha egy sor nem megy át rajta, az korrupt/váratlan adat, `Outcome`
   * hibaágat ad, nem dob kivételt (SPEC-003 9.4 szekció).
   */
  function readGraph(workflowId: string): Outcome<WorkflowGraph> {
    return transaction(() => {
      const nodeRows = database
        .select()
        .from(workflowNodeTable)
        .where(eq(workflowNodeTable.workflowId, workflowId))
        .all();

      const nodes: WorkflowNodeRecord[] = [];
      for (const row of nodeRows) {
        if (!isNodeConfig(row.config)) {
          return {
            kind: 'error',
            message: `A(z) "${row.id}" node config mezője nem érvényes NodeConfig alakú (corrupt_node_config).`,
          };
        }
        nodes.push({
          id: row.id,
          type: row.config.type,
          label: row.label,
          positionX: row.positionX,
          positionY: row.positionY,
          config: row.config,
          createdAtMs: row.createdAtMs,
          updatedAtMs: row.updatedAtMs,
        });
      }

      const edgeRows = database
        .select()
        .from(workflowEdgeTable)
        .where(eq(workflowEdgeTable.workflowId, workflowId))
        .all();
      const edges: WorkflowEdgeRecord[] = edgeRows.map((row) => ({
        id: row.id,
        sourceNodeId: row.sourceNodeId,
        targetNodeId: row.targetNodeId,
        sourceHandle: row.sourceHandle,
        targetHandle: row.targetHandle,
        branchKey: row.branchKey,
        createdAtMs: row.createdAtMs,
      }));

      return { kind: 'ok', value: { nodes, edges } };
    });
  }

  /**
   * A `runCount` és a `snapshotCount` pontos, tényleges darabszám (T-003-16).
   *
   * **`runCount`**: nem elég a `workflow_id = ?` szűrés. A `workflow`
   * törlése a `workflow_run.workflow_id` `ON DELETE CASCADE` miatt közvetlenül
   * elviszi az ehhez a workflow-hoz tartozó sorokat, de ha ezek közül
   * bármelyik **gyökér** futás (`root_run_id = id`), a `root_run_id`
   * önhivatkozó `ON DELETE CASCADE` (4.15 szekció, F-11) továbbviszi a
   * törlést az al-workflow futásaira is - **akkor is, ha azok más
   * workflow-hoz tartoznak** (lásd `workflow-run.spec.ts`, "egy gyökér
   * workflow_run sor törlése kaszkádban elviszi... al-workflow futásokat").
   * A pontos halmaz ezért: az ehhez a workflow-hoz tartozó összes sor, UNIÓ
   * mindazok a sorok (bármelyik workflow-hoz tartozzanak), amiknek a
   * `root_run_id`-je egy, az ehhez a workflow-hoz tartozó **gyökér** futásra
   * mutat. Rekurzív bejárás nem kell: egy `root_run_id` mindig a végső
   * gyökérre mutat, nem a közvetlen szülőre (4.8 szekció), tehát egyetlen
   * szint elég.
   *
   * **`snapshotCount`**: egy `graph_snapshot` sor pontosan akkor válik
   * árvává ebben a törlésben, ha **minden** rá mutató `workflow_run` sor a
   * fenti törlendő halmazban van (4.15 szekció, "hivatkozásszámláló oszlop
   * nincs, a hivatkozottság a `workflow_run` sorokból vezethető le"). Ha akár
   * egyetlen, a törlendő halmazon kívüli sor is ugyanarra a lenyomatra
   * mutat (mert két workflow gráfja bájtra azonos, és megosztja a sort), a
   * pillanatkép megmarad.
   *
   * **`eventCount`** (T-003-27): a `run_event.run_id` idegen kulcs
   * `ON DELETE CASCADE` a `workflow_run` táblára (4.15 szekció lánca,
   * `run-event.ts`), tehát pontosan a fenti `deletedRunIds` halmazhoz tartozó
   * esemény sorok törlődnek - `SELECT COUNT(*) FROM run_event WHERE run_id IN
   * (...)`. A `snapshotCount`-tal ellentétben itt nem kell kaszkád-számítás:
   * a `run_event` a futás gyereke, nem a szülője, és nincs olyan sor, amit
   * egy megmaradó futás megoszthatna a törlődővel (a `run_id` egyértékű).
   * A `step_run_id` szerinti második út sem hoz be új sort: a `step_run` maga
   * is `ON DELETE CASCADE` a `workflow_run` táblára, tehát minden lépéshez
   * kötött esemény ugyanannak a törlődő futásnak a `run_id`-jét hordozza.
   */
  function summarizeDeletion(workflowId: string): Outcome<DeletionSummary> {
    return transaction(() => {
      const existing = database.select().from(workflowTable).where(eq(workflowTable.id, workflowId)).get();
      if (existing === undefined) {
        return { kind: 'error', message: notFoundMessage(workflowId) };
      }

      const ownedRootRunRows = database
        .select({ id: workflowRunTable.id })
        .from(workflowRunTable)
        .where(and(eq(workflowRunTable.workflowId, workflowId), eq(workflowRunTable.rootRunId, workflowRunTable.id)))
        .all();
      const ownedRootRunIds = ownedRootRunRows.map((row) => row.id);

      const directRunRows = database
        .select({ id: workflowRunTable.id, graphSnapshotHash: workflowRunTable.graphSnapshotHash })
        .from(workflowRunTable)
        .where(eq(workflowRunTable.workflowId, workflowId))
        .all();

      const deletedRunIds = new Set(directRunRows.map((row) => row.id));
      const deletedRunHashes = new Set(directRunRows.map((row) => row.graphSnapshotHash));

      if (ownedRootRunIds.length > 0) {
        const cascadedRunRows = database
          .select({ id: workflowRunTable.id, graphSnapshotHash: workflowRunTable.graphSnapshotHash })
          .from(workflowRunTable)
          .where(inArray(workflowRunTable.rootRunId, ownedRootRunIds))
          .all();
        for (const row of cascadedRunRows) {
          deletedRunIds.add(row.id);
          deletedRunHashes.add(row.graphSnapshotHash);
        }
      }

      let snapshotCount = 0;
      if (deletedRunIds.size > 0) {
        for (const hash of deletedRunHashes) {
          const survivingReference = database
            .select({ id: workflowRunTable.id })
            .from(workflowRunTable)
            .where(
              and(eq(workflowRunTable.graphSnapshotHash, hash), notInArray(workflowRunTable.id, [...deletedRunIds])),
            )
            .get();
          if (survivingReference === undefined) {
            snapshotCount += 1;
          }
        }
      }

      // Nyers `sql` aggregát, NEM a típusos select-builder, ugyanaz a minta,
      // mint a `RunEventRepository.aggregateRunTokens`-nél: a `GROUP BY`
      // nélküli aggregát SQLite-ban mindig pontosan egy sort ad, akkor is, ha
      // nulla sor illeszkedik a szűrésre, tehát a `database.get<T>()`
      // deklarált, `undefined`-et nem tartalmazó típusa itt a valós
      // viselkedést tükrözi. A select-builder `.get()`-je ezzel szemben
      // `T | undefined`, ami egy soha be nem következő, tehát tesztelhetetlen
      // ágat kényszerítene ide (SPEC-003 12.4, 100 százalékos lefedettség).
      // Az `inArray` üres halmazra `false` feltételt generál (drizzle-orm
      // 0.45.2, `sql/expressions/conditions.js`, forrásból ellenőrizve), tehát
      // futás nélküli workflow-ra sem kell külön ág.
      const eventCountRow = database.get<{ eventCount: number }>(sql`
        SELECT COUNT(*) AS eventCount
          FROM run_event
         WHERE ${inArray(runEventTable.runId, [...deletedRunIds])}
      `);

      return {
        kind: 'ok',
        value: { runCount: deletedRunIds.size, eventCount: eventCountRow.eventCount, snapshotCount },
      };
    });
  }

  /**
   * Az egyetlen törlési út (SPEC-003 9.2, 9.3). A `workflow` sor törlése a
   * bekapcsolt `foreign_keys` pragma (F-1) és az `ON DELETE CASCADE` lánc
   * (4.15) miatt automatikusan elviszi a `workflow_node`, `workflow_edge` és
   * `workflow_run` sorokat is (utóbbi a `root_run_id` önhivatkozó kaszkádon
   * át az al-workflow futásokat is, akkor is, ha más workflow-hoz tartoznak),
   * kézi törlés nélkül.
   *
   * **Záró lépés: az árva pillanatkép söprés** (4.15 szekció, szó szerint,
   * T-003-16 zárja le). A `graph_snapshot` nem a futás gyereke, hanem a
   * szülője (5.6 szekció), tehát kaszkád nem viheti el: a fenti törlés UTÁN,
   * ugyanabban a tranzakcióban egyetlen söprő utasítás fut, ami minden olyan
   * sort elvisz, amire immár egyetlen `workflow_run` sor sem mutat. A
   * második, adatbázis szintű védelem (`ON DELETE RESTRICT` a
   * `workflow_run.graph_snapshot_hash` idegen kulcson, F-27) visszagörgetné
   * a tranzakciót, ha a söprés feltétele valaha hibás lenne, tehát hivatkozott
   * sor soha nem tűnhet el.
   */
  function deleteWorkflow(input: DeleteWorkflowInput): Outcome<void> {
    return transaction(() => {
      const deleted = database.delete(workflowTable).where(eq(workflowTable.id, input.workflowId)).run();
      if (deleted.changes === 0) {
        return { kind: 'error', message: notFoundMessage(input.workflowId) };
      }
      database.run(sql`DELETE FROM graph_snapshot WHERE hash NOT IN (SELECT graph_snapshot_hash FROM workflow_run)`);
      return { kind: 'ok', value: undefined };
    });
  }

  return {
    createWorkflow,
    updateWorkflow,
    getWorkflow,
    listWorkflows,
    replaceGraph,
    readGraph,
    summarizeDeletion,
    deleteWorkflow,
  };
}
