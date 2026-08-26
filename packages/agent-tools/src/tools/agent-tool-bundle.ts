import type { McpSdkServerConfigWithInstance } from '@anthropic-ai/claude-agent-sdk';

/**
 * Egy lépéshez összeállított eszközkészlet: a `query()` hívás `mcpServers` és
 * `allowedTools` mezőjébe közvetlenül beilleszthető alakban. A két mező azért
 * jár együtt, mert a szerver regisztrálása önmagában még nem engedélyezi az
 * eszközök hívását.
 */
export interface AgentToolBundle {
  readonly mcpServers: Readonly<Record<string, McpSdkServerConfigWithInstance>>;
  readonly allowedTools: readonly string[];
}
