import {
  readBaseUrl,
  readTimeoutMs,
  isOkOutcome,
  type EnvironmentReader,
  type Outcome,
} from '@easter-workflow-builder/core';
import { DEFAULT_FIRECRAWL_BASE_URL, DEFAULT_FIRECRAWL_TIMEOUT_MS } from './default-config-value.ts';
import { ENV_FIRECRAWL_BASE_URL, ENV_FIRECRAWL_TIMEOUT_MS } from './environment-variable-name.ts';
import type { FirecrawlConfig } from './firecrawl-config.ts';

/**
 * A Firecrawl hívás konfigurációjának feloldása. A cím mindig feloldható, mert
 * van alapértelmezése, tehát csak az értelmezhetetlen timeout ad hibaágat.
 */
export function resolveFirecrawlConfig(environment: EnvironmentReader): Outcome<FirecrawlConfig> {
  const timeout = readTimeoutMs(environment, ENV_FIRECRAWL_TIMEOUT_MS, DEFAULT_FIRECRAWL_TIMEOUT_MS);
  if (!isOkOutcome(timeout)) {
    return timeout;
  }
  return {
    kind: 'ok',
    value: {
      baseUrl: readBaseUrl(environment, ENV_FIRECRAWL_BASE_URL, DEFAULT_FIRECRAWL_BASE_URL),
      timeoutMs: timeout.value,
    },
  };
}
