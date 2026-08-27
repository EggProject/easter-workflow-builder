import type { AgentToolRecommendation, Fact } from '@easter-workflow-builder/provider-capability';

/**
 * A listában csak az az eszköz szerepel, amire bizonyíték van. Ami nincs benne,
 * arra nincs ajánlásunk, nem pedig ellenjavallat.
 */
export const minimaxRecommendedAgentTools: Fact<readonly AgentToolRecommendation[]> = {
  state: 'known',
  value: [
    {
      // A szerver oldali keresőt a szolgáltatás csendben eldobja, ezért a saját eszköz nélkül forrás nélküli válasz születik.
      toolId: 'web_search',
      recommended: {
        state: 'known',
        value: true,
        evidence: [
          { kind: 'measurement', id: 'M-17' },
          { kind: 'measurement', id: 'M-25' },
        ],
      },
    },
    {
      // A kép content blokk kimegy a dróton, a szolgáltatás mégsem látja, ezért a képértelmezés csak külön eszközzel érhető el.
      toolId: 'understand_image',
      recommended: {
        state: 'known',
        value: true,
        evidence: [
          { kind: 'measurement', id: 'M-16' },
          { kind: 'measurement', id: 'M-23' },
        ],
      },
    },
  ],
  evidence: [
    { kind: 'measurement', id: 'M-17' },
    { kind: 'measurement', id: 'M-25' },
    { kind: 'measurement', id: 'M-16' },
    { kind: 'measurement', id: 'M-23' },
  ],
};
