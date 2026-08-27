import type { AgentToolId } from '@easter-workflow-builder/agent-tool-id';
import type { AgentToolDependencies } from './agent-tool-dependencies.ts';
import { createImageUnderstandingTool } from './create-image-understanding-tool.ts';
import { createWebFetchTool } from './create-web-fetch-tool.ts';
import { createWebSearchTool } from './create-web-search-tool.ts';

// A három eszköz sémája eltér, ezért a közös visszatérési típus unió. Nem
// exportált: a hívónak az egész csomagot leíró `AgentToolBundle` a felülete.
type AgentToolDefinition =
  | ReturnType<typeof createWebSearchTool>
  | ReturnType<typeof createWebFetchTool>
  | ReturnType<typeof createImageUnderstandingTool>;

/**
 * Egyetlen eszköz létrehozása azonosító alapján. A teljes switch fordítási időben
 * garantálja, hogy új azonosító felvétele nem maradhat kezeletlenül.
 */
export function createAgentTool(toolId: AgentToolId, dependencies: AgentToolDependencies): AgentToolDefinition {
  switch (toolId) {
    case 'web_search': {
      return createWebSearchTool(dependencies);
    }
    case 'web_fetch': {
      return createWebFetchTool(dependencies);
    }
    case 'understand_image': {
      return createImageUnderstandingTool(dependencies);
    }
  }
}
