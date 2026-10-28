import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * A `mcp_server_definition` tábla (SPEC-009 6.2, O-31): a központi MCP
 * szerver lista, definíciónként egy sor. A `name` az elsődleges kulcs, mert a
 * lépés név szerint hivatkozik rá (O-42 (b)); idegen kulcs nincs, a
 * hivatkozás a node config JSON dokumentumában áll, és a definíció törlése
 * hivatkozás mellett is megengedett (O-43 (a)). A `definition` JSON oszlop a
 * séma szintjén `unknown`: a szűkítést a repository olvasáskor az
 * `isMcpServerDefinition` guarddal végzi, ugyanaz a minta, mint a
 * `workflow_node.config` oszlopon. Érték (titok) nem kerül ide, csak env
 * változó név.
 */
export const mcpServerDefinitionTable = sqliteTable('mcp_server_definition', {
  name: text('name').primaryKey(),
  definition: text('definition', { mode: 'json' }).$type<unknown>().notNull(),
});
