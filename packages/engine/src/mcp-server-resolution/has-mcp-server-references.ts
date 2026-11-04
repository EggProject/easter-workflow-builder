import type { AgentStepConfig } from '@easter-workflow-builder/db';
import { isRecord } from '@easter-workflow-builder/typeguards';

function hasEntries(value: unknown): boolean {
  return isRecord(value) && Object.keys(value).length > 0;
}

/**
 * Hivatkozik-e a lépés vagy valamelyik agent definíciója központi MCP
 * szerverre (SPEC-009 6.2, 6.4): a lépés `mcpServerReferences` rekordja vagy
 * egy agent definíció azonos nevű mezője nem üres rekord. A hívó csak ilyenkor
 * olvassa a központi listát, így egyetlen hibás definíció sor
 * (`corrupt_mcp_server_definition`) nem állítja meg az MCP szervert nem
 * használó lépést és futást (PLAN-012 T-012-27).
 *
 * Az agent definíció alakját nem ellenőrzi: egy nem rekord értékű vagy rossz
 * alakú mező itt "nincs hivatkozás", és a `resolveOutgoingAgents` a definíciók
 * nélkül is `malformed_node_config` hibát ad rá.
 */
export function hasMcpServerReferences(config: AgentStepConfig): boolean {
  return (
    hasEntries(config.mcpServerReferences) ||
    Object.values(config.agents).some(
      (definition: unknown) => isRecord(definition) && hasEntries(definition['mcpServerReferences']),
    )
  );
}
