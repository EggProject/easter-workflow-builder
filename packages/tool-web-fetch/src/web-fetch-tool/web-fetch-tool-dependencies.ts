import type { EnvironmentReader, FetchFunction } from '@easter-workflow-builder/firecrawl-client';

/**
 * A `web_fetch` eszköz futásidejű függőségei. Szűk interfész, csak azt a két
 * mezőt hordozza, amit ez az eszköz ténylegesen használ.
 */
export interface WebFetchToolDependencies {
  readonly fetchFunction: FetchFunction;
  readonly environment: EnvironmentReader;
}
