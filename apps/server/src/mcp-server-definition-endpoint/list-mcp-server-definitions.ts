import type { DatabaseContext } from '@easter-workflow-builder/db';
import type { RouteHandler } from '../route-dispatch/route-handler.ts';

/**
 * `GET /api/mcp-servers` (SPEC-009 6.2): a központi MCP szerver lista, név
 * szerint növekvő sorrendben, `McpServerDefinitionRecord` elemekkel. Csak
 * neveket ad ki, értéket soha: a definíció env változó NEVEKET tárol.
 */
export function createListMcpServerDefinitionsHandler(database: DatabaseContext): RouteHandler {
  return () => {
    const listed = database.mcpServerDefinitions.listDefinitions();
    if (listed.kind === 'error') {
      return Promise.resolve(listed);
    }
    return Promise.resolve({ kind: 'ok', value: { status: 200, body: listed.value } });
  };
}
