import type { StructuredOutputCapability } from '@easter-workflow-builder/provider-capability';
import { notMeasuredOnFlash } from '../measurement-gap/not-measured-on-flash.ts';

export const minimaxStructuredOutput: StructuredOutputCapability = {
  strategies: [
    {
      id: 'sdk_output_format',
      usable: {
        state: 'known',
        value: true,
        evidence: [{ kind: 'measurement', id: 'M-03-flash' }],
      },
      blockingWireDetail: {
        state: 'known',
        // Tipusosan ertelmezett "nincs blokkolo" ertek (Fact<string | null>), nem placeholder.
        // eslint-disable-next-line unicorn/no-null -- lasd structured-output-strategy.ts dokumentaciojat
        value: null,
        evidence: [{ kind: 'measurement', id: 'M-03-flash' }],
      },
      observedRoundTrips: {
        state: 'known',
        value: [3],
        evidence: [{ kind: 'measurement', id: 'M-03-flash' }],
      },
    },
  ],
  // A megbízhatóság ismételt futásokon (M-19) a Flash-re nem mért.
  defaultStrategy: notMeasuredOnFlash(['M-19']),
  // Minden kérés output_config mezőt hordoz, Options.effort beállítás nélkül is.
  outputConfigAlwaysSent: {
    state: 'known',
    value: true,
    evidence: [
      { kind: 'measurement', id: 'M-01-flash' },
      { kind: 'measurement', id: 'M-26-flash' },
    ],
  },
  outputConfigWireField: {
    state: 'known',
    value: 'output_config.effort',
    evidence: [
      { kind: 'measurement', id: 'M-01-flash' },
      { kind: 'measurement', id: 'M-26-flash' },
    ],
  },
};
