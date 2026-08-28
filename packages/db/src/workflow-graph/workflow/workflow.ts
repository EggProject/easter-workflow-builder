import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * A `workflow` tábla (SPEC-003 4.1 szekció). A `provider_id` oszlopon
 * szándékosan nincs `CHECK` a felsorolt provider azonosítókkal: egy új
 * provider felvétele akkor migrációt igényelne, holott a provider lista
 * backend config fájlokban él. Az érvényességet a repository határon a
 * `ProviderId` typeguard adja.
 */
export const workflowTable = sqliteTable(
  'workflow',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    providerId: text('provider_id'),
    createdAtMs: integer('created_at_ms', { mode: 'timestamp_ms' }).notNull(),
    updatedAtMs: integer('updated_at_ms', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [index('workflow_updated_at_idx').on(table.updatedAtMs)],
);
