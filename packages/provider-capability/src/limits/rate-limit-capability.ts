import type { Fact } from '@easter-workflow-builder/evidence';
import type { RateLimitBucket } from './rate-limit-bucket.ts';

export interface RateLimitCapability<TModelId extends string> {
  readonly buckets: readonly RateLimitBucket<TModelId>[];
  /**
  Küld-e a provider `Retry-After` headert 429-nél.
  */
  readonly retryAfterHeader: Fact<string | null>;
  /**
  Minden megfigyelt rate limit jellegű header neve.
  */
  readonly rateLimitHeaders: Fact<readonly string[]>;
}
