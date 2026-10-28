import {
  DOC_7MINAI_MINIMAX_M31_FLASH,
  DOC_MINIMAX_ANTHROPIC_API,
  DOC_MINIMAX_CLAUDE_CODE_M_PLAN,
  DOC_MINIMAX_OPENAI_API,
  DOC_WOKEY_MINIMAX_M31_FLASH,
  type ThinkingCapability,
} from '@easter-workflow-builder/provider-capability';
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
  wireShape: {
    state: 'known',
    value: '{"type":"adaptive"}',
    evidence: [
      { kind: 'measurement', id: 'M-01-flash' },
      { kind: 'measurement', id: 'M-05-flash' },
    ],
  },
  // A kikapcsolt thinking mellett a kliens a mezőt elhagyja, budget_tokens kulcs egyik kérésben sincs.
  sendsBudgetTokens: {
    state: 'known',
    value: false,
    evidence: [
      { kind: 'measurement', id: 'M-05-flash' },
      { kind: 'measurement', id: 'M-06-flash' },
    ],
  },
  interleavedSignatureRequired: {
    state: 'unknown',
    reason:
      'A Flash streamje signature_delta eseményt ad, de hogy a thinking blokkot signature-rel vissza kell-e küldeni, a mért futásokból nem dönthető el.',
    blockedBy: ['M-05'],
  },
  streamEventTypes: {
    state: 'known',
    value: ['content_block_start', 'thinking_delta', 'signature_delta', 'content_block_stop'],
    evidence: [
      { kind: 'measurement', id: 'M-01-flash' },
      { kind: 'measurement', id: 'M-03-flash' },
    ],
  },
};
