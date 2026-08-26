import type { StructuredOutputCapability } from '../capability/structured-output-capability.ts';

export const minimaxStructuredOutput: StructuredOutputCapability = {
  strategies: [
    {
      id: 'emit_output_tool',
      // A Stop hook blokkoló ága bizonyítottan kikényszeríti a tool hívást.
      usable: {
        state: 'known',
        value: true,
        evidence: [
          { kind: 'measurement', id: 'M-19' },
          { kind: 'measurement', id: 'M-10' },
        ],
      },
      // A hook szövege user role-lal utazik, a system role kockázat itt nem áll fenn.
      blockingWireDetail: {
        state: 'known',
        // Tipusosan ertelmezett "nincs blokkolo" ertek (Fact<string | null>), nem placeholder.
        // eslint-disable-next-line unicorn/no-null -- lasd structured-output-strategy.ts dokumentaciojat
        value: null,
        evidence: [{ kind: 'measurement', id: 'M-19' }],
      },
      // A blokkolás egy plusz modellkört igényel.
      observedRoundTrips: {
        state: 'known',
        value: [3],
        evidence: [{ kind: 'measurement', id: 'M-19' }],
      },
    },
    {
      id: 'sdk_output_format',
      usable: {
        state: 'known',
        value: true,
        evidence: [
          { kind: 'measurement', id: 'M-02' },
          { kind: 'measurement', id: 'M-03' },
        ],
      },
      blockingWireDetail: {
        state: 'known',
        // Tipusosan ertelmezett "nincs blokkolo" ertek (Fact<string | null>), nem placeholder.
        // eslint-disable-next-line unicorn/no-null -- lasd structured-output-strategy.ts dokumentaciojat
        value: null,
        evidence: [{ kind: 'measurement', id: 'M-03' }],
      },
      observedRoundTrips: {
        state: 'known',
        value: [4],
        evidence: [{ kind: 'measurement', id: 'M-03' }],
      },
    },
  ],
  // Alapértelmezés sdk_output_format, mert nem igényel Stop hookot és nem kell plusz modellkör.
  defaultStrategy: {
    state: 'known',
    value: 'sdk_output_format',
    evidence: [
      { kind: 'measurement', id: 'M-02' },
      { kind: 'measurement', id: 'M-03' },
      { kind: 'measurement', id: 'M-19' },
    ],
  },
  // Minden kérés output_config mezőt hordoz, effort beállítás nélkül is.
  outputConfigAlwaysSent: {
    state: 'known',
    value: true,
    evidence: [
      { kind: 'measurement', id: 'M-01' },
      { kind: 'measurement', id: 'M-04' },
      { kind: 'measurement', id: 'M-26' },
    ],
  },
  outputConfigWireField: {
    state: 'known',
    value: 'output_config.effort',
    evidence: [
      { kind: 'measurement', id: 'M-01' },
      { kind: 'measurement', id: 'M-04' },
    ],
  },
};
