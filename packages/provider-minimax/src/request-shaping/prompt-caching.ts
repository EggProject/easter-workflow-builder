import { RESEARCH_MINIMAX, type PromptCachingCapability } from '@easter-workflow-builder/provider-capability';

export const minimaxPromptCaching: PromptCachingCapability = {
  mode: {
    state: 'unknown',
    reason:
      'Az implicit olvasás és a cache írás igazolt, de az explicit cache_control töréspontok önálló hatása a rendelkezésre álló mérésekből nem választható szét.',
    blockedBy: ['M-15', 'M-20', 'M-24', 'M-33'],
  },
  explicitBreakpointLimit: {
    state: 'known',
    value: 4,
    evidence: [{ kind: 'research', section: RESEARCH_MINIMAX }],
  },
  ttlSeconds: {
    state: 'known',
    value: 300,
    evidence: [{ kind: 'research', section: RESEARCH_MINIMAX }],
  },
  minimumInputTokens: {
    state: 'known',
    value: 512,
    evidence: [{ kind: 'research', section: RESEARCH_MINIMAX }],
  },
  // Csak a ténylegesen megfigyelt cache mezőnév szerepel.
  usageFields: {
    state: 'known',
    value: ['cache_read_input_tokens'],
    evidence: [
      { kind: 'measurement', id: 'M-15' },
      { kind: 'measurement', id: 'M-24' },
    ],
  },
  disableEnvVar: {
    state: 'known',
    value: 'DISABLE_PROMPT_CACHING',
    evidence: [
      { kind: 'measurement', id: 'M-08' },
      { kind: 'measurement', id: 'M-15' },
    ],
  },
  // A kapcsoló csak az SDK automatikus töréspontjait veszi le, a hívó fél sajátját nem.
  callerBreakpointSurvivesDisable: {
    state: 'known',
    value: true,
    evidence: [{ kind: 'measurement', id: 'M-33' }],
  },
};
