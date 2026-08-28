import { type AnySQLiteColumn, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { workflowRunTable } from '../workflow-run/workflow-run.ts';

/**
 * A `step_run` tábla (SPEC-003 4.10 szekció). Egy sor egyetlen lépés
 * végrehajtási kísérletét írja le: fan-out ágban ágonként, ciklusban
 * iterációnként, retrynél kísérletenként külön sor jön létre (lásd lent,
 * "nincs egyediségi megszorítás").
 *
 * **A `node_id` szándékosan NEM idegen kulcs** a `workflow_node` táblára
 * (SPEC-003 4.10, 21. kritérium). A lépés futás a **pillanatképbeli** node-ra
 * hivatkozik, nem az élő workflow node-jára: ha idegen kulcs lenne, egy node
 * törlése a szerkesztőben vagy elvinné a régi futás lépéseit, vagy
 * megakadályozná a szerkesztést, mindkettő ellentmond az 1. döntésnek. A
 * hivatkozás feloldását a `graph_snapshot` dokumentum adja, a repository a
 * lépés lista olvasásakor onnan tölti fel a megjelenítendő adatot
 * (T-003-18).
 *
 * **Nincs egyediségi megszorítás a `(run_id, node_id, iteration, attempt)`
 * négyesen** (SPEC-003 4.10 szekció szó szerint). Egy node jogosan futhat
 * sokszor, és a végrehajtás alakját a `parent_step_run_id` fa, az
 * `iteration` és az `attempt` írja le, egyediségi kényszer nélkül.
 *
 * **A retry új sor, nem állapot.** Egy elbukott lépés `failed` marad, és az
 * `error_handler` egy új `step_run` sort hoz létre `attempt + 1` értékkel,
 * ugyanazzal a `parent_step_run_id` és `node_id` értékkel, tehát a
 * transcript minden kísérletet megmutat.
 *
 * **A `parent_step_run_id` önhivatkozás**, a végrehajtási fa (fan-out és
 * loop szülő-gyerek kapcsolata). A `.references()` callback ezért lusta
 * (`(): AnySQLiteColumn => ...`), ugyanaz a minta, mint a `workflow_run.root_run_id`
 * önhivatkozásánál (`workflow-run.ts`): a hivatkozás csak akkor fut le,
 * amikor a hívó ténylegesen kéri (pl. `getTableConfig` vagy a
 * migrációgenerálás), a modul betöltésekor a `stepRunTable` már inicializált.
 * `ON DELETE CASCADE`: egy szülő lépés törlése a teljes alfát elviszi (F-11).
 *
 * **A `sub_workflow_run_id` `ON DELETE SET NULL`**, nem kaszkád (SPEC-003
 * 4.15 szekció): az al-workflow-t hívó lépés sora megmarad akkor is, ha a
 * hivatkozott al-workflow futás törlődik (pl. a hívott workflow törlése
 * miatt), csak a mutató mező NULL-ozódik.
 *
 * **Az `iteration`, `attempt` és `forked_session` séma szintű technikai
 * alapértéket kap** (`.default()`, SPEC-003 41. kritérium): ez NEM a 6. user
 * döntés jellegű, kitalált konfigurációs érték, hanem a mező saját
 * definíciója szerinti kezdő állapot (0. iteráció, 1. kísérlet, nem forkolt
 * session), a spec 4.10 táblázata "alapból" szóval nevezi meg mindhármat.
 */
export const stepRunTable = sqliteTable(
  'step_run',
  {
    id: text('id').primaryKey(),
    runId: text('run_id')
      .notNull()
      .references(() => workflowRunTable.id, { onDelete: 'cascade' }),
    nodeId: text('node_id').notNull(),
    nodeType: text('node_type').notNull(),
    parentStepRunId: text('parent_step_run_id').references((): AnySQLiteColumn => stepRunTable.id, {
      onDelete: 'cascade',
    }),
    iteration: integer('iteration').notNull().default(0),
    attempt: integer('attempt').notNull().default(1),
    status: text('status').notNull(),
    providerId: text('provider_id').notNull(),
    modelId: text('model_id'),
    sessionMode: text('session_mode'),
    sdkSessionId: text('sdk_session_id'),
    resumedFromSessionId: text('resumed_from_session_id'),
    forkedSession: integer('forked_session', { mode: 'boolean' }).notNull().default(false),
    structuredOutputStrategy: text('structured_output_strategy'),
    output: text('output', { mode: 'json' }).$type<unknown>(),
    resultSubtype: text('result_subtype'),
    numTurns: integer('num_turns'),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    cacheReadInputTokens: integer('cache_read_input_tokens'),
    cacheCreationInputTokens: integer('cache_creation_input_tokens'),
    subWorkflowRunId: text('sub_workflow_run_id').references(() => workflowRunTable.id, { onDelete: 'set null' }),
    errorKind: text('error_kind'),
    errorMessage: text('error_message'),
    startedAtMs: integer('started_at_ms', { mode: 'timestamp_ms' }),
    finishedAtMs: integer('finished_at_ms', { mode: 'timestamp_ms' }),
    createdAtMs: integer('created_at_ms', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('step_run_run_created_idx').on(table.runId, table.createdAtMs),
    index('step_run_run_node_idx').on(table.runId, table.nodeId),
    index('step_run_parent_idx').on(table.parentStepRunId),
    index('step_run_sub_run_idx').on(table.subWorkflowRunId),
  ],
);
