import type { StructuredOutputCapability } from '@easter-workflow-builder/provider-capability';
import { notMeasuredOnFlash } from '../measurement-gap/not-measured-on-flash.ts';

export const minimaxStructuredOutput: StructuredOutputCapability = {
  strategies: [
    {
      id: 'sdk_output_format',
      usable: notMeasuredOnFlash(['M-02', 'M-03']),
      blockingWireDetail: notMeasuredOnFlash(['M-03']),
      observedRoundTrips: notMeasuredOnFlash(['M-03']),
    },
  ],
  defaultStrategy: notMeasuredOnFlash(['M-02', 'M-03', 'M-19']),
  outputConfigAlwaysSent: notMeasuredOnFlash(['M-01', 'M-04', 'M-26']),
  outputConfigWireField: notMeasuredOnFlash(['M-01', 'M-04']),
};
