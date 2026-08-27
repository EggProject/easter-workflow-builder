import { createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import type { AgentToolId } from '@easter-workflow-builder/agent-tool-id';
import type { AgentToolBundle } from './agent-tool-bundle.ts';
import type { AgentToolDependencies } from '../tool-dependencies/agent-tool-dependencies.ts';
import { defaultAgentToolDependencies } from '../tool-dependencies/default-agent-tool-dependencies.ts';
import { agentToolReference } from '../tool-reference/agent-tool-reference.ts';
import { AGENT_TOOLS_SERVER_NAME } from '../tool-reference/agent-tools-server-name.ts';
import { createAgentTool } from '../tool-factory/create-agent-tool.ts';

/**
 * Lépésenként kapcsolható eszközkészlet összeállítása. A hívó megadja, mely
 * eszközöket engedélyezi ezen a lépésen, és megkapja a hozzájuk tartozó MCP
 * szerver konfigurációt és az `allowedTools` listát. Ismétlődő azonosító nem
 * duplikálja az eszközt.
 */
export function createAgentToolBundle(
  selectedToolIds: readonly AgentToolId[],
  dependencies: AgentToolDependencies = defaultAgentToolDependencies,
): AgentToolBundle {
  const uniqueToolIds = [...new Set(selectedToolIds)];
  return {
    mcpServers: {
      [AGENT_TOOLS_SERVER_NAME]: createSdkMcpServer({
        name: AGENT_TOOLS_SERVER_NAME,
        tools: uniqueToolIds.map((toolId) => createAgentTool(toolId, dependencies)),
      }),
    },
    allowedTools: uniqueToolIds.map((toolId) => agentToolReference(toolId)),
  };
}
