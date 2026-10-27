import { RESEARCH_GATEWAY, type StreamingCapability } from '@easter-workflow-builder/provider-capability';
import { notMeasuredOnFlash } from '../measurement-gap/not-measured-on-flash.ts';

export const minimaxStreaming: StreamingCapability = {
  sse: notMeasuredOnFlash(['M-05', 'M-09']),
  toolInputDelta: notMeasuredOnFlash(['M-09']),
  sdkReassemblesToolInput: notMeasuredOnFlash(['M-09']),
  // A Claude Code gateway dokumentációja szerint custom base URL mellett kerülendő, modelltől függetlenül.
  fineGrainedToolStreaming: {
    state: 'known',
    value: false,
    evidence: [{ kind: 'research', section: RESEARCH_GATEWAY }],
  },
  streamDisableable: notMeasuredOnFlash(['M-24']),
};
