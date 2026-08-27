import type { Fact, ServerToolDescriptor } from '@easter-workflow-builder/provider-capability';

// A web_search szerver oldali tool kimegy a dróton, de a MiniMax nem futtatja le.
export const minimaxServerTools: Fact<readonly ServerToolDescriptor[]> = {
  state: 'known',
  value: [
    {
      wireType: 'web_search_20250305',
      name: 'web_search',
      available: {
        state: 'known',
        value: false,
        evidence: [
          { kind: 'measurement', id: 'M-17' },
          { kind: 'measurement', id: 'M-25' },
        ],
      },
    },
  ],
  evidence: [
    { kind: 'measurement', id: 'M-17' },
    { kind: 'measurement', id: 'M-25' },
  ],
};
