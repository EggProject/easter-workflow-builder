import type { PromptCachingCapability } from '@easter-workflow-builder/provider-capability';
import { notMeasuredOnFlash } from '../measurement-gap/not-measured-on-flash.ts';

// A korábbi értékek az előző modell kori dokumentáció kivonatából és mérésből jöttek (SPEC-013 3.2).
const CACHING_MEASUREMENTS = ['M-08', 'M-15', 'M-24', 'M-33'] as const;

export const minimaxPromptCaching: PromptCachingCapability = {
  mode: notMeasuredOnFlash(['M-15', 'M-20', 'M-24', 'M-33']),
  explicitBreakpointLimit: notMeasuredOnFlash(CACHING_MEASUREMENTS),
  ttlSeconds: notMeasuredOnFlash(CACHING_MEASUREMENTS),
  minimumInputTokens: notMeasuredOnFlash(CACHING_MEASUREMENTS),
  usageFields: notMeasuredOnFlash(CACHING_MEASUREMENTS),
  disableEnvVar: notMeasuredOnFlash(CACHING_MEASUREMENTS),
  callerBreakpointSurvivesDisable: notMeasuredOnFlash(CACHING_MEASUREMENTS),
};
