import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { stepRunTable } from '../step-run/step-run.ts';
import { workflowRunTable } from '../workflow-run/workflow-run.ts';

/**
 * A `human_approval` tábla (SPEC-003 4.12 szekció). Egy sor egy
 * `human_approval` node egyetlen jóváhagyási kérését írja le: a `body` és a
 * `payload` a kérés **pillanatában** rögzül (kirenderelve), nem a
 * megjelenítéskor, hogy a fél évvel későbbi visszanézés ugyanazt mutassa,
 * amit a döntéshozó látott.
 *
 * **A `step_run_id` egyedi**: egy lépés futáshoz legfeljebb egy jóváhagyási
 * kérés tartozhat. Az egyediséget a `human_approval_step_uq` névvel
 * explicit megadott `uniqueIndex()` kényszeríti ki (nem a column builder
 * `.unique()` metódusa): a SPEC-003 4.12 szekció szó szerint "indexek"
 * között sorolja fel, ugyanaz a minta, mint a `run_event_run_uuid_uq`
 * (`run-event.ts`), és a `getTableConfig` teszt így a `config.indexes`
 * tömbből, névvel tudja visszakeresni (a column builder `.unique()`-ja egy
 * külön, `config.uniqueConstraints` tömbbe kerülő, redundáns megszorítást
 * hozna létre ugyanerre az oszlopra).
 *
 * **A `run_id` denormalizált** (levezethető lenne a `step_run` soron át),
 * hogy a több futáson átívelő "függő jóváhagyások" lista (`listPendingApprovals`,
 * `human-approval-repository.ts`) egyetlen táblából kiszolgálható legyen,
 * `step_run` join nélkül.
 *
 * **A `decision` nullázható**: NULL, amíg nincs döntés, utána `'approved'`
 * vagy `'rejected'` (`ApprovalDecision`, `approval-decision.ts`). A
 * `human_approval_pending_idx` a `(decision, requested_at_ms)` oszlopokon a
 * "mi vár döntésre, időrendben" lekérdezést szolgálja ki: SQLite az
 * indexben tárolja a NULL értékeket is (F-10), tehát a
 * `WHERE decision IS NULL ORDER BY requested_at_ms` ebből az indexből
 * kiszolgálható.
 *
 * Mindkét idegen kulcs `ON DELETE CASCADE` (SPEC-003 4.15 kaszkád lánc): a
 * `run_id` a `workflow_run` táblára, a `step_run_id` a `step_run` táblára.
 */
export const humanApprovalTable = sqliteTable(
  'human_approval',
  {
    id: text('id').primaryKey(),
    runId: text('run_id')
      .notNull()
      .references(() => workflowRunTable.id, { onDelete: 'cascade' }),
    stepRunId: text('step_run_id')
      .notNull()
      .references(() => stepRunTable.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    body: text('body').notNull(),
    payload: text('payload', { mode: 'json' }).$type<unknown>().notNull(),
    decision: text('decision'),
    requestedAtMs: integer('requested_at_ms', { mode: 'timestamp_ms' }).notNull(),
    decidedAtMs: integer('decided_at_ms', { mode: 'timestamp_ms' }),
  },
  (table) => [
    uniqueIndex('human_approval_step_uq').on(table.stepRunId),
    index('human_approval_pending_idx').on(table.decision, table.requestedAtMs),
  ],
);
