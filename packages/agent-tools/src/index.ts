// Barrel: csak újraexport, a csomag publikus felülete a lépésenként kapcsolható
// eszközkészlet összeállítója és a hozzá tartozó típusok.

export type { EnvironmentReader } from './config/environment-reader.ts';
export {
  ENV_FIRECRAWL_BASE_URL,
  ENV_FIRECRAWL_TIMEOUT_MS,
  ENV_MINIMAX_API_KEY,
  ENV_MINIMAX_BASE_URL,
  ENV_MINIMAX_CODING_PLAN_API_KEY,
  ENV_MINIMAX_TIMEOUT_MS,
} from './config/environment-variable-name.ts';

export type { Outcome } from './result/outcome.ts';
export { isOkOutcome } from './result/is-ok-outcome.ts';
export type { ToolCallResult } from './result/tool-call-result.ts';

export type { AgentToolDependencies } from './tools/agent-tool-dependencies.ts';
export { defaultAgentToolDependencies } from './tools/default-agent-tool-dependencies.ts';
export { AGENT_TOOLS_SERVER_NAME } from './tools/agent-tools-server-name.ts';
export { agentToolReference } from './tools/agent-tool-reference.ts';
export type { AgentToolBundle } from './tools/agent-tool-bundle.ts';
export { createAgentToolBundle } from './tools/create-agent-tool-bundle.ts';
