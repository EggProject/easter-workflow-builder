import type { EnvironmentReader, FetchFunction } from '@easter-workflow-builder/minimax-client';
import type { ReadFileFunction } from '@easter-workflow-builder/image-source';

/**
 * Az `understand_image` eszköz futásidejű függőségei. Mindhárom mező kell: a
 * kép feloldásához a fájlolvasó is, nemcsak a hívó.
 */
export interface UnderstandImageToolDependencies {
  readonly fetchFunction: FetchFunction;
  readonly environment: EnvironmentReader;
  readonly readFileFunction: ReadFileFunction;
}
