import type { ThinkingCapability } from '../capability/thinking-capability.ts';
import { DOC_STREAMING, DOC_THINKING, DOC_THINKING_STEER } from '@easter-workflow-builder/evidence-sources';
import type { ClaudeFamilyId } from './family-id.ts';

export const claudeSubscriptionThinking: ThinkingCapability<ClaudeFamilyId> = {
  // Az aktuális modellgeneráció adaptív thinkinget használ, a régi fix budget mód a legacy manual módhoz tartozik.
  byModelFamily: {
    opus: {
      state: 'known',
      value: ['disabled', 'adaptive'],
      evidence: [
        { kind: 'doc', url: DOC_THINKING },
        { kind: 'doc', url: DOC_THINKING_STEER },
      ],
    },
    sonnet: {
      state: 'known',
      value: ['disabled', 'adaptive'],
      evidence: [
        { kind: 'doc', url: DOC_THINKING },
        { kind: 'doc', url: DOC_THINKING_STEER },
      ],
    },
    haiku: {
      state: 'known',
      value: ['disabled', 'adaptive'],
      evidence: [
        { kind: 'doc', url: DOC_THINKING },
        { kind: 'doc', url: DOC_THINKING_STEER },
      ],
    },
  },
  wireShape: {
    state: 'unknown',
    reason:
      'A dokumentáció példája {"type":"adaptive","display":"summarized"} alakot mutat, de hogy a Claude Code pontosan mit küld ezen az úton, nem mértük.',
    blockedBy: ['M-05', 'M-06'],
  },
  sendsBudgetTokens: {
    state: 'unknown',
    reason: 'Nincs drótszintű mérés ehhez a providerhez.',
    blockedBy: ['M-05'],
  },
  interleavedSignatureRequired: {
    state: 'unknown',
    reason:
      'Az interleaved thinking dokumentáltan beta header nélkül működik, de a thinking blokk visszaadási kötelezettsége modellenként eltér, és ezt nem mértük.',
    blockedBy: ['M-05'],
  },
  streamEventTypes: {
    state: 'known',
    value: ['content_block_start', 'thinking_delta', 'signature_delta', 'content_block_stop'],
    evidence: [{ kind: 'doc', url: DOC_STREAMING }],
  },
};
