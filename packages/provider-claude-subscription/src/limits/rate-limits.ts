import type { RateLimitCapability } from '@easter-workflow-builder/provider-capability';
import type { ClaudeModelId } from '../model-catalog/model-id.ts';

export const claudeSubscriptionRateLimits: RateLimitCapability<ClaudeModelId> = {
  // Az előfizetéses (Pro/Max) út gördülő 5 órás és heti ablakkal működik, publikus RPM/TPM szám nincs hozzá (https://code.claude.com/docs/en/costs), ezért nincs bucket.
  buckets: [],
  retryAfterHeader: {
    state: 'unknown',
    reason:
      'Az API rate limit dokumentáció retry-after headert ír le, de az előfizetéses út más limit modellt használ, és ezt az utat nem mértük.',
    blockedBy: ['M-18'],
  },
  rateLimitHeaders: {
    state: 'unknown',
    reason:
      'Ugyanaz az ok, mint a retryAfterHeader mezőnél: az előfizetéses úton nem mértük, milyen headereket küld a szolgáltatás.',
    blockedBy: ['M-18'],
  },
};
