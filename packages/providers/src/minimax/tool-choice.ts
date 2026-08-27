import type { ToolChoiceCapability } from '../capability/tool-choice-capability.ts';
import { RESEARCH_MINIMAX } from '@easter-workflow-builder/evidence-sources';

export const minimaxToolChoice: ToolChoiceCapability = {
  accepted: {
    state: 'known',
    value: ['auto', 'none'],
    evidence: [{ kind: 'research', section: RESEARCH_MINIMAX }],
  },
  // A nem támogatott tool_choice értéket a MiniMax csendben eldobja, nem utasítja el.
  rejectionBehaviour: {
    state: 'known',
    value: 'silently_dropped',
    evidence: [{ kind: 'measurement', id: 'M-34' }],
  },
  // A kimenő kérések csak auto értéket hordoznak, kényszerített választás nincs.
  sdkSendsForcedChoice: {
    state: 'known',
    value: false,
    evidence: [
      { kind: 'measurement', id: 'M-03' },
      { kind: 'measurement', id: 'M-17' },
    ],
  },
};
