import { describe, expect, it } from 'vitest';
import { RATE_LIMIT_RETRY_POLICY } from './rate-limit-retry-policy.ts';

// A SPEC-004 11.3 táblázat 15. sora az egyetlen, aminek nincs elágazása: a
// motor egyik `Fact` állapotban sem olvas fejlécet, mert a HTTP választ nem is
// látja (a kérés az `agentQueryRunner` port mögött, az SDK-ban indul), és mert
// három mérési körben egyetlen 429 sem érkezett (F-12). A teszt ezért a
// konstans döntést őrzi: ha valaki bevezetne egy leíróból olvasó elágazást
// vagy egy automatikus visszalépést, ez a teszt bukik.
describe('RATE_LIMIT_RETRY_POLICY', () => {
  it('a motor egyetlen provider oldali korlátozási fejlécet sem olvas', () => {
    expect(RATE_LIMIT_RETRY_POLICY.readsProviderRateLimitHeaders).toBe(false);
  });

  it('a motornak nincs saját, automatikus visszalépési logikája', () => {
    expect(RATE_LIMIT_RETRY_POLICY.buildsAutomaticBackoff).toBe(false);
  });

  it('az újrapróbálkozás egyetlen helye az error_handler node', () => {
    expect(RATE_LIMIT_RETRY_POLICY.retryOwner).toBe('error_handler_node');
  });
});
