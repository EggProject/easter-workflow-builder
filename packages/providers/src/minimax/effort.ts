import type { EffortCapability } from '@easter-workflow-builder/provider-capability';

export const minimaxEffort: EffortCapability = {
  // Az effort minden mért beállítás mellett kimegy, a kényszerítő env kapcsoló hatástalan.
  accepted: {
    state: 'known',
    value: true,
    evidence: [
      { kind: 'measurement', id: 'M-04' },
      { kind: 'measurement', id: 'M-26' },
    ],
  },
  wireField: {
    state: 'known',
    value: 'output_config.effort',
    evidence: [
      { kind: 'measurement', id: 'M-04' },
      { kind: 'measurement', id: 'M-26' },
    ],
  },
};
