import { tool, type SdkMcpToolDefinition } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { resolveFirecrawlConfig } from '../config/resolve-firecrawl-config.ts';
import { PATH_SCRAPE } from '../firecrawl/endpoint-path.ts';
import { formatFirecrawlDocument } from '../firecrawl/format-firecrawl-document.ts';
import { interpretScrapeResponse } from '../firecrawl/interpret-scrape-response.ts';
import { postJson } from '../http/post-json.ts';
import { errorToolResult } from '../result/error-tool-result.ts';
import { isOkOutcome } from '../result/is-ok-outcome.ts';
import { textToolResult } from '../result/text-tool-result.ts';
import type { AgentToolDependencies } from './agent-tool-dependencies.ts';

// Lapos séma: csak a cím. A kimeneti formátum mindig markdown, mert az agentnek
// az olvasható szöveg kell, és minden további séma mező a visszautasítás
// kockázatát növelné.
const inputSchema = {
  url: z.string().min(1).describe('Absolute http or https URL of the page to read.'),
};

const description =
  'Fetch a web page and return its main content as clean markdown. Use it to read an article, a documentation page or any URL found in search results.';

/**
Oldalletöltő eszköz a felhasználó saját Firecrawl példánya fölött.
*/
export function createWebFetchTool(dependencies: AgentToolDependencies): SdkMcpToolDefinition<typeof inputSchema> {
  return tool('web_fetch', description, inputSchema, async ({ url }) => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      return errorToolResult('Csak http vagy https címet tudok letölteni, add meg a teljes címet a sémával együtt.');
    }
    const config = resolveFirecrawlConfig(dependencies.environment);
    if (!isOkOutcome(config)) {
      return errorToolResult(config.message);
    }
    const response = await postJson(
      {
        url: `${config.value.baseUrl}${PATH_SCRAPE}`,
        headers: {},
        body: { url: trimmedUrl, formats: ['markdown'] },
        timeoutMs: config.value.timeoutMs,
      },
      dependencies.fetchFunction,
    );
    if (!isOkOutcome(response)) {
      return errorToolResult(`${response.message} Ellenőriztesd a felhasználóval, hogy a Firecrawl példány fut-e.`);
    }
    const document = interpretScrapeResponse(response.value);
    if (!isOkOutcome(document)) {
      return errorToolResult(document.message);
    }
    return textToolResult(formatFirecrawlDocument(document.value));
  });
}
