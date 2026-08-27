import type { Fact } from '@easter-workflow-builder/evidence';

export interface RateLimitBucket<TModelId extends string> {
  readonly appliesTo: readonly TModelId[];
  readonly requestsPerMinute: Fact<number>;
  readonly tokensPerMinute: Fact<number>;
}
