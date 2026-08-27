// Barrel: csak újraexport, a csomag publikus felülete a Firecrawl HTTP kliens.

export type { FirecrawlConfig } from './firecrawl-config/firecrawl-config.ts';
export { resolveFirecrawlConfig } from './firecrawl-config/resolve-firecrawl-config.ts';
export { ENV_FIRECRAWL_BASE_URL, ENV_FIRECRAWL_TIMEOUT_MS } from './firecrawl-config/environment-variable-name.ts';

export { scrapePage } from './scrape-call/scrape-page.ts';

export type { FirecrawlDocument } from './scrape-document/firecrawl-document.ts';
export { interpretScrapeResponse } from './scrape-document/interpret-scrape-response.ts';
export { formatFirecrawlDocument } from './scrape-document/format-firecrawl-document.ts';

// A `resolveFirecrawlConfig` és a `scrapePage` szignatúrájában megjelenő idegen típusok, a
// SPEC-002 6.6 pont 7. szabálya szerint.
export type { EnvironmentReader } from '@easter-workflow-builder/env-reader';
export type { FetchFunction } from '@easter-workflow-builder/http-client';
