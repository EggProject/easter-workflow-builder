import type { Fact, ServerToolDescriptor } from '@easter-workflow-builder/provider-capability';

// A web_search szerver oldali tool a Flash-nél lefut: server_tool_use és web_search_tool_result blokk érkezik.
export const minimaxServerTools: Fact<readonly ServerToolDescriptor[]> = {
  state: 'known',
  value: [
    {
      wireType: 'web_search_20250305',
      name: 'web_search',
      available: {
        state: 'known',
        value: true,
        evidence: [{ kind: 'measurement', id: 'M-17-flash' }],
      },
      clientToolName: {
        state: 'known',
        value: 'WebSearch',
        evidence: [{ kind: 'measurement', id: 'M-17-flash' }],
      },
    },
  ],
  evidence: [{ kind: 'measurement', id: 'M-17-flash' }],
};
