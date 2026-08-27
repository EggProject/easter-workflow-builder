import { describe, expect, it } from 'vitest';
import { DEFAULT_FIRECRAWL_BASE_URL, DEFAULT_FIRECRAWL_TIMEOUT_MS } from './default-config-value.ts';
import { ENV_FIRECRAWL_BASE_URL, ENV_FIRECRAWL_TIMEOUT_MS } from './environment-variable-name.ts';
import { resolveFirecrawlConfig } from './resolve-firecrawl-config.ts';

describe('resolveFirecrawlConfig', () => {
  it('alapértelmezésekkel oldja fel a konfigurációt', () => {
    expect(resolveFirecrawlConfig({})).toStrictEqual({
      kind: 'ok',
      value: { baseUrl: DEFAULT_FIRECRAWL_BASE_URL, timeoutMs: DEFAULT_FIRECRAWL_TIMEOUT_MS },
    });
  });

  it('figyelembe veszi a felülírásokat', () => {
    expect(
      resolveFirecrawlConfig({
        [ENV_FIRECRAWL_BASE_URL]: 'http://localhost:1234',
        [ENV_FIRECRAWL_TIMEOUT_MS]: '2000',
      }),
    ).toStrictEqual({ kind: 'ok', value: { baseUrl: 'http://localhost:1234', timeoutMs: 2000 } });
  });

  it('továbbadja a hibás timeout hibaágát', () => {
    expect(resolveFirecrawlConfig({ [ENV_FIRECRAWL_TIMEOUT_MS]: 'sok' }).kind).toBe('error');
  });
});
