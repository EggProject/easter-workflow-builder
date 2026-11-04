import { findBlankTextField } from '../workflow-graph/node-config/find-blank-text-field.ts';
import type { McpServerDefinition } from './mcp-server-definition.ts';
import { MCP_SERVER_DEFINITION_REQUIRED_TEXT_FIELDS } from './mcp-server-definition-required-text-fields.ts';

/**
 * A központi MCP szerver definíció első üres (vagy csak szóközből álló)
 * kötelező szöveg mezőjének neve (`command`, `url`), vagy `undefined`, ha
 * mind ki van töltve (`MCP_SERVER_DEFINITION_REQUIRED_TEXT_FIELDS`). Az
 * "üres" jelentése a node config szabályáé (`findBlankTextField`).
 */
export function findBlankMcpServerDefinitionField(definition: McpServerDefinition): string | undefined {
  const fields: readonly string[] = MCP_SERVER_DEFINITION_REQUIRED_TEXT_FIELDS[definition.type];
  return fields.find((field) => findBlankTextField(definition, field) !== undefined);
}
