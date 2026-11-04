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
        // Típusosan értelmezett "nincs blokkoló" érték (Fact<string | null>), nem placeholder.
        // eslint-disable-next-line unicorn/no-null -- lásd structured-output-strategy.ts dokumentációját
        value: null,
        evidence: [{ kind: 'measurement', id: 'M-03-flash' }],
      },
      // A 3 az M-03 mérési prompt körszáma: a prompt egy kikényszerített echo tool hívást is tartalmazott,
      // tehát ez nem a strukturált kimenet minimuma, a motor maxTurns alsó korlátja mégis ebből jön.
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
