import {
  DOC_MINIMAX_CLAUDE_CODE_M_PLAN,
  RESEARCH_AUTH_PRECEDENCE,
  RESEARCH_GATEWAY,
  RESEARCH_MINIMAX,
  type EnvironmentRequirement,
} from '@easter-workflow-builder/provider-capability';

export const minimaxRequiredEnvironment: readonly EnvironmentRequirement[] = [
  {
    name: 'ANTHROPIC_BASE_URL',
    source: 'literal',
    literalValue: 'https://api.minimax.io/anthropic',
    secret: false,
    purpose: 'A nemzetközi MiniMax Anthropic-kompatibilis endpoint.',
    evidence: [{ kind: 'research', section: RESEARCH_MINIMAX }],
  },
  {
    name: 'ANTHROPIC_AUTH_TOKEN',
    source: 'process_env_alternatives',
    alternativeNames: ['ANTHROPIC_API_KEY'],
    secret: true,
    purpose:
      'A kulcs az ANTHROPIC_AUTH_TOKEN vagy az ANTHROPIC_API_KEY process env változóból jön (ha mindkettő áll, az ANTHROPIC_AUTH_TOKEN nyer), és ANTHROPIC_AUTH_TOKEN néven megy ki Bearer tokenként; az adatbázis csak a NEVET tárolja.',
    evidence: [
      { kind: 'research', section: RESEARCH_MINIMAX },
      { kind: 'research', section: RESEARCH_GATEWAY },
      { kind: 'doc', url: DOC_MINIMAX_CLAUDE_CODE_M_PLAN },
      { kind: 'research', section: RESEARCH_AUTH_PRECEDENCE },
    ],
  },
  {
    name: 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC',
    source: 'literal',
    literalValue: '1',
    secret: false,
    purpose:
      'Levágja a session cím generáló háttérkérést és a DesignSync toolt, csökkentve a kérésszámot és a token felhasználást.',
    evidence: [
      { kind: 'measurement', id: 'M-07' },
      { kind: 'measurement', id: 'M-08' },
      { kind: 'measurement', id: 'M-21' },
    ],
  },
];
