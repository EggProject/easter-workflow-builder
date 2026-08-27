import { tool, type SdkMcpToolDefinition } from '@anthropic-ai/claude-agent-sdk';
import { errorToolResult, textToolResult } from '@easter-workflow-builder/mcp-tool-kit';
import {
  callMiniMax,
  formatSearchResponse,
  isSearchResponse,
  PATH_SEARCH,
  resolveMiniMaxConfig,
} from '@easter-workflow-builder/minimax-client';
import { isOkOutcome } from '@easter-workflow-builder/result';
import { z } from 'zod';
import type { WebSearchToolDependencies } from './web-search-tool-dependencies.ts';

// Lapos séma, egyetlen kötelező szöveges mezővel. A mérésünk szerint a MiniMax
// a tool sémát nem utasítja vissza újrapróbálkozással, ezért egy bonyolultabb
// séma azonnali hibát okozna, javítási lehetőség nélkül.
const inputSchema = {
  query: z.string().min(1).describe('Search query, ideally 3 to 5 keywords.'),
};

const description =
  'Search the web and return the ranked organic results with title, link and snippet. Use it whenever the answer depends on current or external information. If the results are not useful, rephrase the query with different keywords.';

/**
 * Web kereső eszköz a MiniMax kereső végpontja fölött. Azért kell, mert a
 * MiniMax Anthropic kompatibilis endpontja a szerver oldali keresőt csendben
 * eldobja, tehát a modell forrás nélkül, a saját tudásából válaszolna.
 */
export function createWebSearchTool(dependencies: WebSearchToolDependencies): SdkMcpToolDefinition<typeof inputSchema> {
  return tool('web_search', description, inputSchema, async ({ query }) => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length === 0) {
      return errorToolResult('A keresési kifejezés üres. Adj meg legalább egy kulcsszót.');
    }
    const config = resolveMiniMaxConfig(dependencies.environment);
    if (!isOkOutcome(config)) {
      return errorToolResult(config.message);
    }
    const response = await callMiniMax(config.value, PATH_SEARCH, { q: trimmedQuery }, dependencies.fetchFunction);
    if (!isOkOutcome(response)) {
      return errorToolResult(response.message);
    }
    if (!isSearchResponse(response.value)) {
      return errorToolResult('A kereső válasza ismeretlen alakú, a találatok nem olvashatók ki belőle.');
    }
    return textToolResult(formatSearchResponse(response.value.organic));
  });
}
