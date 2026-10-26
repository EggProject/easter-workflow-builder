import {
  RESEARCH_AUTH_PRECEDENCE,
  RESEARCH_GATEWAY,
  RESEARCH_MINIMAX,
  type DisallowedEnvironmentRequirement,
} from '@easter-workflow-builder/provider-capability';

// Más hitelesítők (SPEC-012 3.2, O-4): a felhő provider választók az `ANTHROPIC_AUTH_TOKEN` fölött állnak, a
// többi alatta, tehát a sorrend szerint nem nyernek; a tiltás óvatossági, hogy Anthropic hitelesítő ne kerüljön
// egy harmadik fél endpointjához.
const AUTH_PRECEDENCE_EVIDENCE = [{ kind: 'research', section: RESEARCH_AUTH_PRECEDENCE }] as const;

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
  {
    name: 'CLAUDE_CODE_USE_BEDROCK',
    reason:
      'Felhő provider választó, a hitelesítési sorrend 1. szintje, az ANTHROPIC_AUTH_TOKEN fölött: elvinné a lépést a MiniMax mellől.',
    evidence: AUTH_PRECEDENCE_EVIDENCE,
  },
  {
    name: 'CLAUDE_CODE_USE_VERTEX',
    reason:
      'Felhő provider választó, a hitelesítési sorrend 1. szintje, az ANTHROPIC_AUTH_TOKEN fölött: elvinné a lépést a MiniMax mellől.',
    evidence: AUTH_PRECEDENCE_EVIDENCE,
  },
  {
    name: 'CLAUDE_CODE_USE_FOUNDRY',
    reason:
      'Felhő provider választó, a hitelesítési sorrend 1. szintje, az ANTHROPIC_AUTH_TOKEN fölött: elvinné a lépést a MiniMax mellől.',
    evidence: AUTH_PRECEDENCE_EVIDENCE,
  },
  {
    name: 'CLAUDE_CODE_USE_ANTHROPIC_AWS',
    reason:
      'Provider választó az env-vars lapon; a hitelesítési sorrend lapja nem sorolja fel, a rangja nem ellenőrzött, ezért a leírása miatt tiltott.',
    evidence: AUTH_PRECEDENCE_EVIDENCE,
  },
  {
    name: 'CLAUDE_CODE_USE_MANTLE',
    reason:
      'Provider választó az env-vars lapon; a hitelesítési sorrend lapja nem sorolja fel, a rangja nem ellenőrzött, ezért a leírása miatt tiltott.',
    evidence: AUTH_PRECEDENCE_EVIDENCE,
  },
  {
    name: 'ANTHROPIC_API_KEY',
    reason:
      'A hitelesítési sorrend 3. szintje, az ANTHROPIC_AUTH_TOKEN alatt: óvatossági tiltás, hogy Anthropic hitelesítő ne kerüljön a MiniMax endpointhoz. Hogy a CLI elküldené-e, nem ellenőrzött.',
    evidence: AUTH_PRECEDENCE_EVIDENCE,
  },
  {
    name: 'CLAUDE_CODE_OAUTH_TOKEN',
    reason:
      'A hitelesítési sorrend 5. szintje, az ANTHROPIC_AUTH_TOKEN alatt: óvatossági tiltás, hogy előfizetéses token ne kerüljön a MiniMax endpointhoz. Hogy a CLI elküldené-e, nem ellenőrzött.',
    evidence: AUTH_PRECEDENCE_EVIDENCE,
  },
  {
    name: 'ANTHROPIC_PROFILE',
    reason:
      'Anthropic profil, a hitelesítési sorrendben az ANTHROPIC_AUTH_TOKEN alatt: óvatossági tiltás. Hogy a CLI elküldené-e, nem ellenőrzött.',
    evidence: AUTH_PRECEDENCE_EVIDENCE,
  },
  {
    name: 'ANTHROPIC_FEDERATION_RULE_ID',
    reason:
      'Federációs hitelesítő az ANTHROPIC_ORGANIZATION_ID párjával, az ANTHROPIC_AUTH_TOKEN alatt: óvatossági tiltás. Hogy a CLI elküldené-e, nem ellenőrzött.',
    evidence: AUTH_PRECEDENCE_EVIDENCE,
  },
  {
    name: 'ANTHROPIC_ORGANIZATION_ID',
    reason:
      'Federációs hitelesítő az ANTHROPIC_FEDERATION_RULE_ID párjával, az ANTHROPIC_AUTH_TOKEN alatt: óvatossági tiltás. Hogy a CLI elküldené-e, nem ellenőrzött.',
    evidence: AUTH_PRECEDENCE_EVIDENCE,
  },
];
