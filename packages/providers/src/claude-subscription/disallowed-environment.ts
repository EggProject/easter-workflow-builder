import type { DisallowedEnvironmentRequirement } from '../capability/disallowed-environment-requirement.ts';
import { RESEARCH_GATEWAY } from '@easter-workflow-builder/evidence-sources';

export const claudeSubscriptionDisallowedEnvironment: readonly DisallowedEnvironmentRequirement[] = [
  {
    name: 'ANTHROPIC_BASE_URL',
    reason: 'Felülírja az endpointot, amivel a provider megszűnik first-party lenni.',
    evidence: [{ kind: 'research', section: RESEARCH_GATEWAY }],
  },
];
