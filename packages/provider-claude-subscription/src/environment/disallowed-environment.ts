import {
  RESEARCH_AUTH_PRECEDENCE,
  RESEARCH_GATEWAY,
  type DisallowedEnvironmentRequirement,
} from '@easter-workflow-builder/provider-capability';

// A hitelesítési sorrend szerint a `/login` fölött álló env források (SPEC-012 3.2): bármelyik jelenléte
// elvinné a lépést az előfizetéses hitelesítéstől. A `CLAUDE_CODE_OAUTH_TOKEN` szándékosan nincs itt, mert
// maga is előfizetéses út (SPEC-012 O-3).
const AUTH_PRECEDENCE_EVIDENCE = [{ kind: 'research', section: RESEARCH_AUTH_PRECEDENCE }] as const;

export const claudeSubscriptionDisallowedEnvironment: readonly DisallowedEnvironmentRequirement[] = [
  {
    name: 'ANTHROPIC_BASE_URL',
    reason: 'Felülírja az endpointot, amivel a provider megszűnik first-party lenni.',
    evidence: [{ kind: 'research', section: RESEARCH_GATEWAY }],
  },
  {
    name: 'CLAUDE_CODE_USE_BEDROCK',
    reason: 'Felhő provider választó, a hitelesítési sorrend 1. szintje: elvinné a lépést az előfizetéstől.',
    evidence: AUTH_PRECEDENCE_EVIDENCE,
  },
  {
    name: 'CLAUDE_CODE_USE_VERTEX',
    reason: 'Felhő provider választó, a hitelesítési sorrend 1. szintje: elvinné a lépést az előfizetéstől.',
    evidence: AUTH_PRECEDENCE_EVIDENCE,
  },
  {
    name: 'CLAUDE_CODE_USE_FOUNDRY',
    reason: 'Felhő provider választó, a hitelesítési sorrend 1. szintje: elvinné a lépést az előfizetéstől.',
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
    name: 'ANTHROPIC_AUTH_TOKEN',
    reason:
      'A hitelesítési sorrend 2. szintje, a `/login` fölött: a `minimax` lépés titka, ide nem juthat (SPEC-012 O-5).',
    evidence: AUTH_PRECEDENCE_EVIDENCE,
  },
  {
    name: 'ANTHROPIC_API_KEY',
    reason: 'A hitelesítési sorrend 3. szintje, a `/login` fölött: az előfizetés helyett a kulcs számlázna.',
    evidence: AUTH_PRECEDENCE_EVIDENCE,
  },
  {
    name: 'ANTHROPIC_PROFILE',
    reason: 'Anthropic profil, a hitelesítési sorrendben a `/login` fölött áll.',
    evidence: AUTH_PRECEDENCE_EVIDENCE,
  },
  {
    name: 'ANTHROPIC_FEDERATION_RULE_ID',
    reason: 'Federációs hitelesítő az `ANTHROPIC_ORGANIZATION_ID` párjával, a `/login` fölött áll.',
    evidence: AUTH_PRECEDENCE_EVIDENCE,
  },
  {
    name: 'ANTHROPIC_ORGANIZATION_ID',
    reason: 'Federációs hitelesítő az `ANTHROPIC_FEDERATION_RULE_ID` párjával, a `/login` fölött áll.',
    evidence: AUTH_PRECEDENCE_EVIDENCE,
  },
];
