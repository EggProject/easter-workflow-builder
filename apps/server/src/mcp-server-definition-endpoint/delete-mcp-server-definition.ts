import type { DatabaseContext } from '@easter-workflow-builder/db';
import type { RouteHandler } from '../route-dispatch/route-handler.ts';

/**
 * `DELETE /api/mcp-servers/:name` (SPEC-009 6.2): sikerre `204`, üres
 * törzzsel; nem létező névre `not_found`. Hivatkozást nem vizsgál: a törlés
 * akkor is megy, ha egy lépés hivatkozik a definícióra (O-43 (a)), és a futás
 * indítása ad rá megnevezett hibát (`mcp_server_not_found`, PLAN-012 T-012-11).
 */
export function createDeleteMcpServerDefinitionHandler(database: DatabaseContext): RouteHandler {
  return (context) => {
    const deleted = database.mcpServerDefinitions.deleteDefinition(context.parameters['name'] ?? '');
    if (deleted.kind === 'error') {
      return Promise.resolve(deleted);
    }
    return Promise.resolve({ kind: 'ok', value: { status: 204, body: undefined } });
  };
}
