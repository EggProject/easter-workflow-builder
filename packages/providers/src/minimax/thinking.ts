import type { ThinkingCapability } from '../capability/thinking-capability.ts';
import { RESEARCH_MINIMAX } from '@easter-workflow-builder/evidence-sources';
import type { MiniMaxFamilyId } from './family-id.ts';

export const minimaxThinking: ThinkingCapability<MiniMaxFamilyId> = {
  byModelFamily: {
    M3: {
      state: 'known',
      value: ['disabled', 'adaptive'],
      evidence: [
        { kind: 'research', section: RESEARCH_MINIMAX },
        { kind: 'measurement', id: 'M-05' },
        { kind: 'measurement', id: 'M-06' },
      ],
    },
  },
  wireShape: {
    state: 'known',
    value: '{"type":"adaptive"}',
    evidence: [
      { kind: 'measurement', id: 'M-01' },
      { kind: 'measurement', id: 'M-05' },
    ],
  },
  sendsBudgetTokens: {
    state: 'known',
    value: false,
    evidence: [
      { kind: 'measurement', id: 'M-05' },
      { kind: 'measurement', id: 'M-06' },
    ],
  },
  interleavedSignatureRequired: {
    state: 'known',
    value: true,
    evidence: [
      { kind: 'research', section: RESEARCH_MINIMAX },
      { kind: 'measurement', id: 'M-05' },
    ],
  },
  streamEventTypes: {
    state: 'known',
    value: ['content_block_start', 'thinking_delta', 'signature_delta', 'content_block_stop'],
    evidence: [{ kind: 'measurement', id: 'M-05' }],
  },
};
