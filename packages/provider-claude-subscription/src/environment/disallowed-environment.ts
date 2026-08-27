import { RESEARCH_GATEWAY, type DisallowedEnvironmentRequirement } from '@easter-workflow-builder/provider-capability';

export const claudeSubscriptionDisallowedEnvironment: readonly DisallowedEnvironmentRequirement[] = [
  {
    name: 'ANTHROPIC_BASE_URL',
    reason: 'Felülírja az endpointot, amivel a provider megszűnik first-party lenni.',
    evidence: [{ kind: 'research', section: RESEARCH_GATEWAY }],
  },
];
