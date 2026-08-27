import { DOC_STREAMING, type StreamingCapability } from '@easter-workflow-builder/provider-capability';

export const claudeSubscriptionStreaming: StreamingCapability = {
  sse: {
    state: 'known',
    value: true,
    evidence: [{ kind: 'doc', url: DOC_STREAMING }],
  },
  toolInputDelta: {
    state: 'known',
    value: 'input_json_delta',
    evidence: [{ kind: 'doc', url: DOC_STREAMING }],
  },
  sdkReassemblesToolInput: {
    state: 'unknown',
    reason: 'Bájtszintű összevetés csak méréssel végezhető, ezt a providert nem mértük drótszinten.',
    blockedBy: ['M-09'],
  },
  fineGrainedToolStreaming: {
    state: 'unknown',
    reason:
      'Az API támogatja a tool szintű eager_input_streaming kapcsolót, de hogy a Claude Code first-party úton bekapcsolja-e, nem mértük.',
    blockedBy: ['M-09'],
  },
  // SDK szintű tulajdonság: a telepített SDK Options típusa nem enged stream mezőt beállítani.
  streamDisableable: {
    state: 'known',
    value: false,
    evidence: [{ kind: 'measurement', id: 'M-24' }],
  },
};
