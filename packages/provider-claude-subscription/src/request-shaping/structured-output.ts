import {
  DOC_EFFORT,
  DOC_STRUCTURED,
  DOC_THINKING_STEER,
  type StructuredOutputCapability,
} from '@easter-workflow-builder/provider-capability';

export const claudeSubscriptionStructuredOutput: StructuredOutputCapability = {
  strategies: [
    {
      id: 'sdk_output_format',
      // Az Anthropic Messages API natívan támogatja a strukturált kimenetet.
      usable: {
        state: 'known',
        value: true,
        evidence: [{ kind: 'doc', url: DOC_STRUCTURED }],
      },
      blockingWireDetail: {
        state: 'known',
        // A `Fact<string | null>` tipus szandekosan null-t var, ha nincs blokkolo
        // drotreszlet (lasd structured-output-strategy.ts). Ez valodi, mert
        // meghatarozott adatertek, nem placeholder, ezert a `unicorn/no-null`
        // szabaly itt fajlmintara szukitve, sor szinten kikapcsolva.
        // eslint-disable-next-line unicorn/no-null -- tipusosan ertelmezett "nincs blokkolo" ertek
        value: null,
        evidence: [{ kind: 'doc', url: DOC_STRUCTURED }],
      },
      observedRoundTrips: {
        state: 'unknown',
        reason: 'Nincs drótszintű mérés ehhez a providerhez.',
        blockedBy: ['M-02', 'M-03'],
      },
    },
  ],
  defaultStrategy: {
    state: 'known',
    value: 'sdk_output_format',
    evidence: [{ kind: 'doc', url: DOC_STRUCTURED }],
  },
  outputConfigAlwaysSent: {
    state: 'unknown',
    reason: 'Nincs drótszintű mérés ehhez a providerhez.',
    blockedBy: ['M-01', 'M-04'],
  },
  outputConfigWireField: {
    state: 'known',
    value: 'output_config.effort',
    evidence: [
      { kind: 'doc', url: DOC_EFFORT },
      { kind: 'doc', url: DOC_THINKING_STEER },
    ],
  },
};
