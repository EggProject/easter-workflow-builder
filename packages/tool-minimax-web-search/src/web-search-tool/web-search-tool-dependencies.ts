import type { EnvironmentReader, FetchFunction } from '@easter-workflow-builder/minimax-client';

/**
 * A `web_search` eszköz futásidejű függőségei. Szűk interfész, csak azt a két
 * mezőt hordozza, amit ez az eszköz ténylegesen használ.
 */
export interface WebSearchToolDependencies {
  readonly fetchFunction: FetchFunction;
  readonly environment: EnvironmentReader;
}
