import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * A `workflow` tábla (SPEC-003 4.1 szekció). A `provider_id` oszlopon
 * szándékosan nincs `CHECK` a felsorolt provider azonosítókkal: egy új
 * provider felvétele akkor migrációt igényelne, holott a provider lista
 * backend config fájlokban él. Az érvényességet a repository határon a
 * `ProviderId` typeguard adja.
 *
 * A `builtin_skills_enabled` (SPEC-009 O-44, user döntés 2026-11-04) a CLI
 * beépített skilljeinek workflow szintű felülírása: `NULL` esetén a globális
 * `app_setting.builtin_skills_enabled` dönt, tehát szállított alapértéke nincs.
 */
export const workflowTable = sqliteTable(
  'workflow',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    providerId: text('provider_id'),
    builtinSkillsEnabled: integer('builtin_skills_enabled', { mode: 'boolean' }),
    createdAtMs: integer('created_at_ms', { mode: 'timestamp_ms' }).notNull(),
    updatedAtMs: integer('updated_at_ms', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [index('workflow_updated_at_idx').on(table.updatedAtMs)],
);
