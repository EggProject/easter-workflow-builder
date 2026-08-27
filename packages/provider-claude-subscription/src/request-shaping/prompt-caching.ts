import { DOC_CACHING, DOC_ENV_VARS, type PromptCachingCapability } from '@easter-workflow-builder/provider-capability';

export const claudeSubscriptionPromptCaching: PromptCachingCapability = {
  mode: {
    state: 'known',
    value: 'explicit',
    evidence: [{ kind: 'doc', url: DOC_CACHING }],
  },
  explicitBreakpointLimit: {
    state: 'known',
    value: 4,
    evidence: [{ kind: 'doc', url: DOC_CACHING }],
  },
  ttlSeconds: {
    state: 'known',
    value: 300,
    evidence: [{ kind: 'doc', url: DOC_CACHING }],
  },
  // A minimum cacheelhető input token modellenként eltér (512-4096 token között), a mező viszont egyetlen számot vár.
  minimumInputTokens: {
    state: 'unknown',
    reason:
      'A minimum cacheelhető input token modellenként eltér, a mező viszont egyetlen számot vár, ezért típusjavítás kell, mielőtt kitölthető.',
    blockedBy: ['M-15'],
  },
  usageFields: {
    state: 'known',
    value: ['cache_creation_input_tokens', 'cache_read_input_tokens'],
    evidence: [{ kind: 'doc', url: DOC_CACHING }],
  },
  disableEnvVar: {
    state: 'known',
    value: 'DISABLE_PROMPT_CACHING',
    evidence: [{ kind: 'doc', url: DOC_ENV_VARS }],
  },
  // A MiniMax leíróból mért érték ide nem másolható át, ez a mező itt önállóan mérendő.
  callerBreakpointSurvivesDisable: {
    state: 'unknown',
    reason:
      'A hívó fél saját cache_control blokkjának sorsa a DISABLE_PROMPT_CACHING mellett first-party úton nincs mérve.',
    blockedBy: ['M-33'],
  },
};
