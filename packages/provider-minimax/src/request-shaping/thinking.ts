import {
  DOC_7MINAI_MINIMAX_M31_FLASH,
  DOC_MINIMAX_ANTHROPIC_API,
  DOC_MINIMAX_CLAUDE_CODE_M_PLAN,
  DOC_MINIMAX_OPENAI_API,
  DOC_WOKEY_MINIMAX_M31_FLASH,
  type ThinkingCapability,
} from '@easter-workflow-builder/provider-capability';
import { notMeasuredOnFlash } from '../measurement-gap/not-measured-on-flash.ts';
import type { MiniMaxFamilyId } from '../model-catalog/family-id.ts';

export const minimaxThinking: ThinkingCapability<MiniMaxFamilyId> = {
  // A Flash mindig gondolkodik: a disabled mód 400 választ kap, ezért csak az adaptive engedett (SPEC-013 3.3).
  byModelFamily: {
    'M3.1-Flash': {
      state: 'known',
      value: ['adaptive'],
      evidence: [
        { kind: 'doc', url: DOC_MINIMAX_ANTHROPIC_API },
        { kind: 'doc', url: DOC_MINIMAX_OPENAI_API },
        { kind: 'doc', url: DOC_MINIMAX_CLAUDE_CODE_M_PLAN },
        { kind: 'doc', url: DOC_WOKEY_MINIMAX_M31_FLASH },
        { kind: 'doc', url: DOC_7MINAI_MINIMAX_M31_FLASH },
      ],
    },
  },
  wireShape: notMeasuredOnFlash(['M-01', 'M-05']),
  sendsBudgetTokens: notMeasuredOnFlash(['M-05', 'M-06']),
  interleavedSignatureRequired: notMeasuredOnFlash(['M-05']),
  streamEventTypes: notMeasuredOnFlash(['M-05']),
};
