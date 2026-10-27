import type { RateLimitCapability } from '@easter-workflow-builder/provider-capability';
import type { MiniMaxModelId } from '../model-catalog/model-id.ts';

export const minimaxRateLimits: RateLimitCapability<MiniMaxModelId> = {
  buckets: [
    {
      appliesTo: ['MiniMax-M3.1-Flash'],
      // A számokat csak a MiniMax saját lapjai állítják, a Flash-re független megerősítés nincs (research 2. szekció).
      requestsPerMinute: {
        state: 'unknown',
        reason:
          'A Flash limitjét csak a MiniMax lapjai állítják, független forrás hiányzik, és nincs olyan mérési eset, ami a limit értékét lezárná (SPEC-013 3.2).',
        blockedBy: [],
      },
      tokensPerMinute: {
        state: 'unknown',
        reason:
          'A Flash limitjét csak a MiniMax lapjai állítják, független forrás hiányzik, és nincs olyan mérési eset, ami a limit értékét lezárná (SPEC-013 3.2).',
        blockedBy: [],
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
