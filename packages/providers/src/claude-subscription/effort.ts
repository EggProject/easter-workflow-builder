import type { EffortCapability } from '../capability/effort-capability.ts';
import { DOC_EFFORT, DOC_THINKING_STEER } from '@easter-workflow-builder/evidence-sources';

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
