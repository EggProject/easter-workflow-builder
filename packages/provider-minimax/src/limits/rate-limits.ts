import {
  DOC_MINIMAX_RATE_LIMITS,
  RESEARCH_MINIMAX_FLASH,
  type RateLimitCapability,
} from '@easter-workflow-builder/provider-capability';
import type { MiniMaxModelId } from '../model-catalog/model-id.ts';

export const minimaxRateLimits: RateLimitCapability<MiniMaxModelId> = {
  buckets: [
    {
      appliesTo: ['MiniMax-M3.1-Flash'],
      requestsPerMinute: {
        state: 'known',
        value: 200,
        evidence: [
          { kind: 'doc', url: DOC_MINIMAX_RATE_LIMITS },
          { kind: 'research', section: RESEARCH_MINIMAX_FLASH },
        ],
      },
      tokensPerMinute: {
        state: 'known',
        value: 10_000_000,
        evidence: [
          { kind: 'doc', url: DOC_MINIMAX_RATE_LIMITS },
          { kind: 'research', section: RESEARCH_MINIMAX_FLASH },
        ],
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
