import { RESEARCH_MINIMAX, type RateLimitCapability } from '@easter-workflow-builder/provider-capability';
import type { MiniMaxModelId } from '../model-catalog/model-id.ts';

export const minimaxRateLimits: RateLimitCapability<MiniMaxModelId> = {
  buckets: [
    {
      appliesTo: ['MiniMax-M3'],
      requestsPerMinute: {
        state: 'known',
        value: 200,
        evidence: [{ kind: 'research', section: RESEARCH_MINIMAX }],
      },
      tokensPerMinute: {
        state: 'known',
        value: 10_000_000,
        evidence: [{ kind: 'research', section: RESEARCH_MINIMAX }],
      },
    },
  ],
  // Egyetlen mért kérés sem kapott 429 választ, ezért a header ismeretlen marad, szándékos kimerítést nem végzünk.
  retryAfterHeader: {
    state: 'unknown',
    reason: 'Egyetlen mért kérés sem kapott 429 választ, ezért a header ismeretlen marad.',
    blockedBy: ['M-18', 'M-36'],
  },
  rateLimitHeaders: {
    state: 'unknown',
    reason: 'A mért válaszok headerei között nincs rate limit jellegű elem, de 429 hiányában ez nem bizonyíték.',
    blockedBy: ['M-18', 'M-36'],
  },
};
