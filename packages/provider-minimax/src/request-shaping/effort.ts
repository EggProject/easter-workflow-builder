import {
  DOC_MINIMAX_ANTHROPIC_API,
  DOC_MINIMAX_TEXT_GENERATION,
  type EffortCapability,
} from '@easter-workflow-builder/provider-capability';

// A Flash az `output_config.effort` mezőt fogadja (low ... max), a dokumentáció szerint.
export const minimaxEffort: EffortCapability = {
  accepted: {
    state: 'known',
    value: true,
    evidence: [
      { kind: 'doc', url: DOC_MINIMAX_ANTHROPIC_API },
      { kind: 'doc', url: DOC_MINIMAX_TEXT_GENERATION },
    ],
  },
  wireField: {
    state: 'known',
    value: 'output_config.effort',
    evidence: [
      { kind: 'doc', url: DOC_MINIMAX_ANTHROPIC_API },
      { kind: 'doc', url: DOC_MINIMAX_TEXT_GENERATION },
    ],
  },
};
