import { RESEARCH_GATEWAY, type StreamingCapability } from '@easter-workflow-builder/provider-capability';
import { notMeasuredOnFlash } from '../measurement-gap/not-measured-on-flash.ts';

export const minimaxStreaming: StreamingCapability = {
  // A Flash SSE választ ad, és az SDK a részleges üzeneteket stream_event alakban továbbadja.
  sse: {
    state: 'known',
    value: true,
    evidence: [
      { kind: 'measurement', id: 'M-05-flash' },
      { kind: 'measurement', id: 'M-09-flash' },
    ],
  },
  toolInputDelta: {
    state: 'known',
    value: 'input_json_delta',
    evidence: [{ kind: 'measurement', id: 'M-09-flash' }],
  },
  // Bájtszintű egyezés a tool callback inputja és az assistant tool_use blokk között.
  sdkReassemblesToolInput: {
    state: 'known',
    value: true,
    evidence: [{ kind: 'measurement', id: 'M-09-flash' }],
  },
  // A Claude Code gateway dokumentációja szerint custom base URL mellett kerülendő, modelltől függetlenül.
  fineGrainedToolStreaming: {
    state: 'known',
    value: false,
    evidence: [{ kind: 'research', section: RESEARCH_GATEWAY }],
  },
  streamDisableable: notMeasuredOnFlash(['M-24']),
};
