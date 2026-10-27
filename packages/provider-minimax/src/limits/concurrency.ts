import { DOC_ENV_VARS, type ConcurrencyCapability } from '@easter-workflow-builder/provider-capability';
import { notMeasuredOnFlash } from '../measurement-gap/not-measured-on-flash.ts';

export const minimaxConcurrency: ConcurrencyCapability = {
  // A Claude Code env változója, modelltől független.
  subagentCapEnvVar: {
    state: 'known',
    value: 'CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS',
    evidence: [{ kind: 'doc', url: DOC_ENV_VARS }],
  },
  measuredSubagentCap: notMeasuredOnFlash(['M-31']),
  observedMaxConcurrentRequests: notMeasuredOnFlash(['M-31']),
  measuredMaxConcurrentSteps: notMeasuredOnFlash(['M-39']),
};
