import type { ToolChoiceCapability } from '@easter-workflow-builder/provider-capability';
import { notMeasuredOnFlash } from '../measurement-gap/not-measured-on-flash.ts';

// A Flash dokumentációja ellentmondásos, a mérés dönt (SPEC-013 3.2).
export const minimaxToolChoice: ToolChoiceCapability = {
  accepted: notMeasuredOnFlash(['M-03', 'M-34']),
  rejectionBehaviour: notMeasuredOnFlash(['M-34']),
  sdkSendsForcedChoice: notMeasuredOnFlash(['M-03', 'M-17']),
};
