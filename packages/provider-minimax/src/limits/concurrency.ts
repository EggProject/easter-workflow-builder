import { DOC_ENV_VARS, type ConcurrencyCapability } from '@easter-workflow-builder/provider-capability';

// A megfigyelt kérésszám csúcsa a subagent korlát plusz egy, az orchestrátor kérésével együtt.
export const minimaxConcurrency: ConcurrencyCapability = {
  subagentCapEnvVar: {
    state: 'known',
    value: 'CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS',
    evidence: [
      { kind: 'measurement', id: 'M-31' },
      { kind: 'doc', url: DOC_ENV_VARS },
    ],
  },
  measuredSubagentCap: {
    state: 'known',
    value: 3,
    evidence: [{ kind: 'measurement', id: 'M-31' }],
  },
  observedMaxConcurrentRequests: {
    state: 'known',
    value: 4,
    evidence: [{ kind: 'measurement', id: 'M-31' }],
  },
};
