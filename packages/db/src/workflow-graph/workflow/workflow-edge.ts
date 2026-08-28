import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { workflowTable } from './workflow.ts';
import { workflowNodeTable } from './workflow-node.ts';

/**
 * A `workflow_edge` tábla (SPEC-003 4.7 szekció). Az él nem hordoz feltétel
 * kifejezést: a feltétel a `branch` node configjában áll, az él csak azt
 * mondja meg, melyik kimeneti ághoz tartozik (`branch_key`).
 */
export const workflowEdgeTable = sqliteTable(
  'workflow_edge',
  {
    id: text('id').primaryKey(),
    workflowId: text('workflow_id')
      .notNull()
      .references(() => workflowTable.id, { onDelete: 'cascade' }),
    sourceNodeId: text('source_node_id')
      .notNull()
      .references(() => workflowNodeTable.id, { onDelete: 'cascade' }),
    targetNodeId: text('target_node_id')
      .notNull()
      .references(() => workflowNodeTable.id, { onDelete: 'cascade' }),
    sourceHandle: text('source_handle'),
    targetHandle: text('target_handle'),
    branchKey: text('branch_key'),
    createdAtMs: integer('created_at_ms', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('workflow_edge_workflow_idx').on(table.workflowId),
    index('workflow_edge_source_idx').on(table.sourceNodeId),
    index('workflow_edge_target_idx').on(table.targetNodeId),
  ],
);
