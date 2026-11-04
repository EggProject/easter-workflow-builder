import type { AgentStepConfig, McpServerReference } from '@easter-workflow-builder/db';

/**
 * Egy agent definíció (`AgentStepConfig.agents` egy értéke) a motor két
 * olvasott mezőjével és a többi, változatlanul továbbadott mezővel (SPEC-009
 * 5.2, 6.2, M-147).
 *
 * - `skills`: a lépés `skills` mezőjének tárolt alakja (puszta nevek, `'all'`
 *   vagy `null`); a kulcs hiánya `null`.
 * - `mcpServerReferences`: a lépés azonos nevű mezőjének alakja (név ->
 *   hivatkozás a központi definícióra, felülírással); a kulcs hiánya üres
 *   rekord.
 * - `rest`: minden más mező, a régi `mcpServers` SDK mezővel együtt.
 */
export interface ParsedAgentDefinition {
  readonly rest: Readonly<Record<string, unknown>>;
  readonly skills: AgentStepConfig['skills'];
  readonly mcpServerReferences: Readonly<Record<string, McpServerReference>>;
}
