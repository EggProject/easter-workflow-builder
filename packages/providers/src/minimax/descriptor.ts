import type { ProviderCapabilityDescriptor } from '../capability/provider-capability-descriptor.ts';
import type { Fact } from '../evidence/fact.ts';
import { DOC_ENV_VARS } from '../references/document-url.ts';
import { minimaxConcurrency } from './concurrency.ts';
import { minimaxDisallowedEnvironment } from './disallowed-environment.ts';
import { minimaxEffort } from './effort.ts';
import type { MiniMaxFamilyId } from './family-id.ts';
import type { MiniMaxModelId } from './model-id.ts';
import { minimaxModels } from './models.ts';
import { minimaxPromptCaching } from './prompt-caching.ts';
import { minimaxRateLimits } from './rate-limits.ts';
import { minimaxRecommendedAgentTools } from './recommended-agent-tools.ts';
import { minimaxRequiredEnvironment } from './required-environment.ts';
import { minimaxServerTools } from './server-tools.ts';
import { minimaxStreaming } from './streaming.ts';
import { minimaxStructuredOutput } from './structured-output.ts';
import { minimaxThinking } from './thinking.ts';
import { minimaxToolChoice } from './tool-choice.ts';

// A fő kérés header listája a véglegesített konfigurációval, suffixes modellazonosítóval mérve.
const anthropicBetaHeaders: Fact<readonly string[]> = {
  state: 'known',
  value: [
    'claude-code-20250219',
    'interleaved-thinking-2025-05-14',
    'thinking-token-count-2026-05-13',
    'context-management-2025-06-27',
    'prompt-caching-scope-2026-01-05',
    'mid-conversation-system-2026-04-07',
    'effort-2025-11-24',
    'context-1m-2025-08-07',
  ],
  evidence: [
    { kind: 'measurement', id: 'M-01' },
    { kind: 'measurement', id: 'M-14' },
    { kind: 'measurement', id: 'M-11' },
    { kind: 'measurement', id: 'M-32' },
  ],
};

/**
 * A `minimax` provider képességleírója. Minden `known` mező mögött mérési
 * azonosító vagy hivatalos dokumentáció áll, bizonyíték a `evidence` mezőben.
 * A mérés részletei a `docs/research` alatt vannak, ide nem kerülnek át.
 */
export const minimaxProvider = {
  id: 'minimax',
  displayName: 'MiniMax',
  sdkVersionPin: '0.3.245',
  measuredAt: '2026-08-26',
  requiredEnv: minimaxRequiredEnvironment,
  disallowedEnv: minimaxDisallowedEnvironment,
  structuredOutput: minimaxStructuredOutput,
  toolChoice: minimaxToolChoice,
  thinking: minimaxThinking,
  effort: minimaxEffort,
  promptCaching: minimaxPromptCaching,
  streaming: minimaxStreaming,
  serverTools: minimaxServerTools,
  recommendedAgentTools: minimaxRecommendedAgentTools,
  models: minimaxModels,
  modelsEndpoint: {
    directHttpReachable: {
      state: 'known',
      value: true,
      evidence: [{ kind: 'measurement', id: 'M-35' }],
    },
    // Az SDK egyik mért kérés sorozatban sem hívta meg ezt a végpontot.
    calledBySdk: {
      state: 'known',
      value: false,
      evidence: [
        { kind: 'measurement', id: 'M-12' },
        { kind: 'measurement', id: 'M-36' },
        { kind: 'doc', url: DOC_ENV_VARS },
      ],
    },
    listedModelCount: {
      state: 'known',
      value: 8,
      evidence: [{ kind: 'measurement', id: 'M-35' }],
    },
  },
  rateLimits: minimaxRateLimits,
  concurrency: minimaxConcurrency,
  anthropicBetaHeaders,
} satisfies ProviderCapabilityDescriptor<MiniMaxModelId, MiniMaxFamilyId>;
