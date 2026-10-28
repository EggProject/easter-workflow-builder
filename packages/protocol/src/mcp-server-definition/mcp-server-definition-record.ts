import { z } from 'zod';
import { McpServerDefinitionSchema } from './mcp-server-definition.ts';
import { McpServerNameSchema } from './mcp-server-name.ts';

/**
 * Egy központi MCP szerver definíció a nevével (SPEC-009 6.2): a `GET
 * /api/mcp-servers` lista eleme és a `PUT /api/mcp-servers/:name` válasza, a
 * `packages/db` `McpServerDefinitionRecord` párja.
 */
export const McpServerDefinitionRecordSchema = z
  .strictObject({
    name: McpServerNameSchema,
    definition: McpServerDefinitionSchema,
  })
  .readonly();

export type McpServerDefinitionRecord = z.infer<typeof McpServerDefinitionRecordSchema>;
