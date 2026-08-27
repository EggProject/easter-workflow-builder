import { DOC_EFFORT, DOC_THINKING_STEER, type EffortCapability } from '@easter-workflow-builder/provider-capability';

export const claudeSubscriptionEffort: EffortCapability = {
  accepted: {
    state: 'known',
    value: true,
    evidence: [{ kind: 'doc', url: DOC_EFFORT }],
  },
  wireField: {
    state: 'known',
    value: 'output_config.effort',
    evidence: [
      { kind: 'doc', url: DOC_EFFORT },
      { kind: 'doc', url: DOC_THINKING_STEER },
    ],
  },
};
