import type { EnvironmentRequirement } from '../capability/environment-requirement.ts';
import { RESEARCH_GATEWAY, RESEARCH_MINIMAX } from '@easter-workflow-builder/evidence-sources';

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
    source: 'process_env_passthrough',
    secret: true,
    purpose: 'A MINIMAX_API_KEY process env változó értéke megy Bearer tokenként, az adatbázis csak a NEVET tárolja.',
    evidence: [
      { kind: 'research', section: RESEARCH_MINIMAX },
      { kind: 'research', section: RESEARCH_GATEWAY },
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
