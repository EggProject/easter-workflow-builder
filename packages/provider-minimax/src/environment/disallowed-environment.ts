import {
  RESEARCH_GATEWAY,
  RESEARCH_MINIMAX,
  type DisallowedEnvironmentRequirement,
} from '@easter-workflow-builder/provider-capability';

export const minimaxDisallowedEnvironment: readonly DisallowedEnvironmentRequirement[] = [
  {
    name: 'CLAUDE_CODE_ENABLE_FINE_GRAINED_TOOL_STREAMING',
    reason: 'Custom base URL mellett kerülendő: beta tool séma mezőket kényszerít ki, amiket a MiniMax nem ismer.',
    evidence: [{ kind: 'research', section: RESEARCH_GATEWAY }],
  },
  {
    name: 'CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING',
    reason:
      'Fix budget alakú thinking mezőt kényszerít ki, a MiniMax sémája viszont csak disabled és adaptive értéket ismer, budget_tokens kulcs nélkül.',
    evidence: [
      { kind: 'research', section: RESEARCH_GATEWAY },
      { kind: 'research', section: RESEARCH_MINIMAX },
    ],
  },
  {
    name: 'MAX_THINKING_TOKENS',
    reason:
      'A 0 érték leveszi a thinking és context_management body mezőket, de a hozzájuk tartozó anthropic-beta headereket a headerben hagyja, és kikapcsolja az M3 adaptív thinkingjét.',
    evidence: [
      { kind: 'measurement', id: 'M-06' },
      { kind: 'measurement', id: 'M-08' },
    ],
  },
];
