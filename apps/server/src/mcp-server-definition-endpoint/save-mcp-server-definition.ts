import {
  McpServerDefinitionSaveSchema,
  McpServerNameSchema,
  zodErrorToProtocolErrorBody,
} from '@easter-workflow-builder/protocol';
import type { DatabaseContext } from '@easter-workflow-builder/db';
import type { RouteHandler } from '../route-dispatch/route-handler.ts';

/**
 * `PUT /api/mcp-servers/:name` (SPEC-009 6.2): a központi definíció
 * létrehozása vagy teljes cseréje név szerint, a skill feltöltés `PUT`
 * mintájára; sikerre `200` a mentett `{ name, definition }` rekorddal. A név a
 * 6.1 névszabályon, a törzs a `McpServerDefinitionSchema` mentési szabályain
 * megy át (env változó név alak, a hozzárendelés kulcsa deklarált név, a
 * `stdio` `command` és a `sse`, `http` `url` kötelező, nem üres szöveg:
 * `McpServerDefinitionSaveSchema`); bármelyik hibája `invalid_request`. A `db`
 * `saveDefinition` ugyanezt a kötelező mező szabályt is ellenőrzi
 * (`blank_required_text_field`), ez az ág a HTTP úton a séma miatt nem fut.
 */
export function createSaveMcpServerDefinitionHandler(database: DatabaseContext): RouteHandler {
  return (context) => {
    const name = context.parameters['name'] ?? '';
    if (!McpServerNameSchema.safeParse(name).success) {
      return Promise.resolve({
        kind: 'error',
        message: `A(z) "${name}" MCP szerver név nem felel meg a névszabálynak (invalid_request).`,
      });
    }
    const parsedBody = McpServerDefinitionSaveSchema.safeParse(context.body);
    if (!parsedBody.success) {
      return Promise.resolve({ kind: 'error', message: zodErrorToProtocolErrorBody(parsedBody.error).message });
    }
    const record = { name, definition: parsedBody.data };
    const saved = database.mcpServerDefinitions.saveDefinition(record);
    if (saved.kind === 'error') {
      return Promise.resolve(saved);
    }
    return Promise.resolve({ kind: 'ok', value: { status: 200, body: record } });
  };
}
