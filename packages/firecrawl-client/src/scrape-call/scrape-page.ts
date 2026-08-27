import { postJson, type FetchFunction } from '@easter-workflow-builder/http-client';
import type { Outcome } from '@easter-workflow-builder/result';
import type { FirecrawlConfig } from '../firecrawl-config/firecrawl-config.ts';
import { PATH_SCRAPE } from './endpoint-path.ts';

/**
 * Firecrawl scrape hívás, feldolgozatlan JSON válasszal. A szűkítést a
 * `scrape-document` téma `interpretScrapeResponse` függvénye végzi a hívó
 * oldalon, ugyanúgy, ahogy a `minimax-client` `callMiniMax` függvénye is a
 * nyers választ adja tovább.
 */
export function scrapePage(
  url: string,
  config: FirecrawlConfig,
  fetchFunction: FetchFunction,
): Promise<Outcome<unknown>> {
  return postJson(
    {
      url: `${config.baseUrl}${PATH_SCRAPE}`,
      headers: {},
      body: { url, formats: ['markdown'] },
      timeoutMs: config.timeoutMs,
    },
    fetchFunction,
  );
}
