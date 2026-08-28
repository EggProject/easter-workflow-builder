import { DOC_ENV_VARS, type ConcurrencyCapability } from '@easter-workflow-builder/provider-capability';

// A korlátozó env változó neve kliens szintű, ezért dokumentációból ismert; a megfigyelt egyidejű kérésszám mérés kérdése, és ezen az úton nem mértünk.
export const claudeSubscriptionConcurrency: ConcurrencyCapability = {
  subagentCapEnvVar: {
    state: 'known',
    value: 'CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS',
    evidence: [{ kind: 'doc', url: DOC_ENV_VARS }],
  },
  measuredSubagentCap: {
    state: 'unknown',
    reason:
      'Nincs drótszintű mérés ehhez a providerhez, ezért nincs olyan korlát érték, ami mellett a kérésszám csúcsa megfigyelhető lett volna.',
    blockedBy: ['M-31'],
  },
  observedMaxConcurrentRequests: {
    state: 'unknown',
    reason:
      'A sweep-line számítás proxyn átmenő kérésekre épül, first-party úton nincs proxy, tehát nincs mért egyidejű kérésszám.',
    blockedBy: ['M-31'],
  },
  measuredMaxConcurrentSteps: {
    state: 'unknown',
    reason: 'Erre a providerre nem futott párhuzamossági mérés.',
    blockedBy: ['M-39'],
  },
};
