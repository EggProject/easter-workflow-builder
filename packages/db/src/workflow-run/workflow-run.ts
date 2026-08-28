import { type AnySQLiteColumn, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { graphSnapshotTable } from '../graph-snapshot/stored-snapshot/graph-snapshot.ts';
import { workflowTable } from '../workflow-graph/workflow/workflow.ts';

/**
 * A `workflow_run` tábla (SPEC-003 4.8 szekció). Egy sor egyetlen futást ír
 * le, gyökér- vagy al-workflow futást egyaránt: a `root_run_id` gyökér
 * futásnál a saját `id`-jára mutat, al-workflow futásnál a hívó lánc
 * gyökerére. A `workflow_ancestry` a rekurzióvédelem bemenete (a gyökértől
 * idáig vezető `workflow.id` lista), séma szinten `unknown` JSON, mert a
 * szűkítést a repository határ végzi majd (T-003-16).
 *
 * **A `graph_snapshot_hash` idegen kulcs `ON DELETE RESTRICT`** (F-27,
 * F-28, 51. kritérium): amíg akár egy futás hivatkozik egy pillanatképre, a
 * `graph_snapshot` sor törlése hibázik. Ez a `deleteWorkflow` árva
 * söprésének (SPEC-003 4.15 szekció) második, adatbázis szintű védelme.
 *
 * **Két önhivatkozó idegen kulcs.** A `root_run_id` és a
 * `restarted_from_run_id` is a saját `id` oszlopra mutat, ezért a
 * `.references()` callback a saját `workflowRunTable` konstansra hivatkozik
 * lusta (`(): AnySQLiteColumn => ...`) alakban: a hivatkozás csak akkor fut
 * le, amikor a hívó ténylegesen kéri (pl. `getTableConfig` vagy a
 * migrációgenerálás), a modul betöltésekor a `workflowRunTable` már
 * inicializált lesz (https://orm.drizzle.team/docs/indexes-constraints#foreign-key,
 * "Foreign key" szekció, self reference példa; ugyanez SQLite dialektusra
 * `AnySQLiteColumn` típussal:
 * https://www.answeroverflow.com/m/1348374486336012379).
 * A `root_run_id` kaszkádol (`ON DELETE CASCADE`): egy gyökér futás törlése
 * az összes al-workflow futását is elviszi (F-11). A
 * `restarted_from_run_id` `ON DELETE SET NULL`: az újraindított futás
 * megmarad akkor is, ha az eredeti sora törlődik (4.15 szekció).
 */
export const workflowRunTable = sqliteTable(
  'workflow_run',
  {
    id: text('id').primaryKey(),
    workflowId: text('workflow_id')
      .notNull()
      .references(() => workflowTable.id, { onDelete: 'cascade' }),
    status: text('status').notNull(),
    input: text('input', { mode: 'json' }).$type<unknown>().notNull(),
    providerId: text('provider_id').notNull(),
    rootRunId: text('root_run_id')
      .notNull()
      .references((): AnySQLiteColumn => workflowRunTable.id, { onDelete: 'cascade' }),
    depth: integer('depth').notNull(),
    workflowAncestry: text('workflow_ancestry', { mode: 'json' }).$type<unknown>().notNull(),
    graphSnapshotHash: text('graph_snapshot_hash')
      .notNull()
      .references(() => graphSnapshotTable.hash, { onDelete: 'restrict' }),
    persistedStreamDeltas: integer('persisted_stream_deltas', { mode: 'boolean' }).notNull(),
    restartedFromRunId: text('restarted_from_run_id').references((): AnySQLiteColumn => workflowRunTable.id, {
      onDelete: 'set null',
    }),
    createdAtMs: integer('created_at_ms', { mode: 'timestamp_ms' }).notNull(),
    startedAtMs: integer('started_at_ms', { mode: 'timestamp_ms' }),
    finishedAtMs: integer('finished_at_ms', { mode: 'timestamp_ms' }),
    errorKind: text('error_kind'),
    errorMessage: text('error_message'),
  },
  (table) => [
    index('workflow_run_workflow_created_idx').on(table.workflowId, table.createdAtMs),
    index('workflow_run_status_idx').on(table.status),
    index('workflow_run_root_idx').on(table.rootRunId),
    index('workflow_run_snapshot_idx').on(table.graphSnapshotHash),
  ],
);
