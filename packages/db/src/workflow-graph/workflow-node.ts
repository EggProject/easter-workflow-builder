import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { workflowTable } from './workflow.ts';

/**
 * A `workflow_node` tábla (SPEC-003 4.2 szekció). A `type` és a `config`
 * oszlop a séma szintjén szándékosan tág (`text`, illetve `unknown` JSON): a
 * `NodeType` unió és a node config unió a `workflow-graph` téma egy későbbi
 * lépésében (T-003-11) készül el, a szűkítést ott typeguard végzi a
 * repository határon, nem `CHECK` constraint.
 */
export const workflowNodeTable = sqliteTable(
  'workflow_node',
  {
    id: text('id').primaryKey(),
    workflowId: text('workflow_id')
      .notNull()
      .references(() => workflowTable.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    label: text('label').notNull(),
    positionX: real('position_x').notNull(),
    positionY: real('position_y').notNull(),
    config: text('config', { mode: 'json' }).$type<unknown>().notNull(),
    createdAtMs: integer('created_at_ms', { mode: 'timestamp_ms' }).notNull(),
    updatedAtMs: integer('updated_at_ms', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [index('workflow_node_workflow_idx').on(table.workflowId)],
);
