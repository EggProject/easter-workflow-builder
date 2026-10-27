import {
  DOC_7MINAI_MINIMAX_M31_FLASH,
  DOC_CLOUDFLARE_MINIMAX_M31_FLASH,
  DOC_FOUNDERMAG_MINIMAX_M31_FLASH,
  DOC_MINIMAX_ANTHROPIC_API,
  DOC_MINIMAX_TEXT_GENERATION,
  DOC_WOKEY_MINIMAX_M31_FLASH,
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
      { kind: 'doc', url: DOC_CLOUDFLARE_MINIMAX_M31_FLASH },
      { kind: 'doc', url: DOC_WOKEY_MINIMAX_M31_FLASH },
    ],
  },
  wireField: {
    state: 'known',
    value: 'output_config.effort',
    evidence: [
      { kind: 'doc', url: DOC_MINIMAX_ANTHROPIC_API },
      { kind: 'doc', url: DOC_MINIMAX_TEXT_GENERATION },
      { kind: 'doc', url: DOC_7MINAI_MINIMAX_M31_FLASH },
      { kind: 'doc', url: DOC_FOUNDERMAG_MINIMAX_M31_FLASH },
    ],
  },
};
