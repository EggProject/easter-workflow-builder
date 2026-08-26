import type { StreamingCapability } from '../capability/streaming-capability.ts';
import { RESEARCH_GATEWAY } from '../references/research-section.ts';

export const minimaxStreaming: StreamingCapability = {
  sse: {
    state: 'known',
    value: true,
    evidence: [
      { kind: 'measurement', id: 'M-05' },
      { kind: 'measurement', id: 'M-09' },
    ],
  },
  toolInputDelta: {
    state: 'known',
    value: 'input_json_delta',
    evidence: [{ kind: 'measurement', id: 'M-09' }],
  },
  // Bájtszintű egyezés a tool callback inputja és az assistant tool_use blokk között.
  sdkReassemblesToolInput: {
    state: 'known',
    value: true,
    evidence: [{ kind: 'measurement', id: 'M-09' }],
  },
  // A kimenő header egyetlen kérésben sem tartalmaz fine-grained tool streaming elemet.
  fineGrainedToolStreaming: {
    state: 'known',
    value: false,
    evidence: [
      { kind: 'research', section: RESEARCH_GATEWAY },
      { kind: 'measurement', id: 'M-14' },
    ],
  },
  // A telepített SDK Options típusa nem enged stream mezőt beállítani.
  streamDisableable: {
    state: 'known',
    value: false,
    evidence: [{ kind: 'measurement', id: 'M-24' }],
  },
};
