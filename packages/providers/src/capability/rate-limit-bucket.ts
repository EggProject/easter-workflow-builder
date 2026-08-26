import type { Fact } from '../evidence/fact.ts';

export interface RateLimitBucket<TModelId extends string> {
  readonly appliesTo: readonly TModelId[];
  readonly requestsPerMinute: Fact<number>;
  readonly tokensPerMinute: Fact<number>;
}
