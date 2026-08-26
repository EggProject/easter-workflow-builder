import type { AgentToolId } from 'providers';
import { AGENT_TOOLS_SERVER_NAME } from './agent-tools-server-name.ts';

/**
Egy eszköz teljes, `allowedTools` listába illő neve.
*/
export function agentToolReference(toolId: AgentToolId): string {
  return `mcp__${AGENT_TOOLS_SERVER_NAME}__${toolId}`;
}
