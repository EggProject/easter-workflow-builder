import {
  DOC_MINIMAX_ANTHROPIC_API,
  DOC_MINIMAX_CLAUDE_CODE_M_PLAN,
  DOC_MINIMAX_OPENAI_API,
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
      ],
    },
  },
  wireShape: notMeasuredOnFlash(['M-01', 'M-05']),
  sendsBudgetTokens: notMeasuredOnFlash(['M-05', 'M-06']),
  // A thinking blokkot a későbbi körökben változatlanul vissza kell adni.
  interleavedSignatureRequired: {
    state: 'known',
    value: true,
    evidence: [{ kind: 'doc', url: DOC_MINIMAX_ANTHROPIC_API }],
  },
  streamEventTypes: notMeasuredOnFlash(['M-05']),
};
