import type { ProviderCapabilityDescriptor } from '@easter-workflow-builder/provider-capability';
import type { Fact } from '@easter-workflow-builder/evidence';
import { DOC_MODELS_LIST } from '@easter-workflow-builder/evidence-sources';
import { claudeSubscriptionConcurrency } from '../limits/concurrency.ts';
import { claudeSubscriptionDisallowedEnvironment } from '../environment/disallowed-environment.ts';
import { claudeSubscriptionEffort } from '../request-shaping/effort.ts';
import type { ClaudeFamilyId } from '../model-catalog/family-id.ts';
import type { ClaudeModelId } from '../model-catalog/model-id.ts';
import { claudeSubscriptionModels } from '../model-catalog/models.ts';
import { claudeSubscriptionPromptCaching } from '../request-shaping/prompt-caching.ts';
import { claudeSubscriptionRateLimits } from '../limits/rate-limits.ts';
import { claudeSubscriptionRecommendedAgentTools } from '../tool-support/recommended-agent-tools.ts';
import { claudeSubscriptionRequiredEnvironment } from '../environment/required-environment.ts';
import { claudeSubscriptionServerTools } from '../tool-support/server-tools.ts';
import { claudeSubscriptionStreaming } from '../request-shaping/streaming.ts';
import { claudeSubscriptionStructuredOutput } from '../request-shaping/structured-output.ts';
import { claudeSubscriptionThinking } from '../request-shaping/thinking.ts';
import { claudeSubscriptionToolChoice } from '../request-shaping/tool-choice.ts';

const anthropicBetaHeaders: Fact<readonly string[]> = {
  state: 'unknown',
  reason: 'Nincs drótszintű mérés ehhez a providerhez.',
  blockedBy: ['M-14'],
};

/**
 * A `claude-subscription` provider képességleírója.
 *
 * FONTOS: ezt a providert a SPEC-000 1. szekciója szerint NEM mértük drótszinten,
 * mert first-party base URL-t és bejelentkezésen alapuló hitelesítést használ.
 * Ezért itt minden `known` mező mögött hivatalos Anthropic dokumentáció áll, és
 * minden olyan mező `unknown`, ami csak méréssel dönthető el. A MiniMax leíró
 * értékei ide nem másolhatók át.
 *
 * A `measuredAt` itt a dokumentáció-ellenőrzés dátuma, nem drótszintű mérésé.
 */
export const claudeSubscriptionProvider = {
  id: 'claude-subscription',
  displayName: 'Claude Code előfizetés',
  sdkVersionPin: '0.3.245',
  measuredAt: '2026-08-26',
  requiredEnv: claudeSubscriptionRequiredEnvironment,
  disallowedEnv: claudeSubscriptionDisallowedEnvironment,
  structuredOutput: claudeSubscriptionStructuredOutput,
  toolChoice: claudeSubscriptionToolChoice,
  thinking: claudeSubscriptionThinking,
  effort: claudeSubscriptionEffort,
  promptCaching: claudeSubscriptionPromptCaching,
  streaming: claudeSubscriptionStreaming,
  serverTools: claudeSubscriptionServerTools,
  recommendedAgentTools: claudeSubscriptionRecommendedAgentTools,
  models: claudeSubscriptionModels,
  modelsEndpoint: {
    // A Messages API mellett a GET /v1/models végpont dokumentált és listáz.
    directHttpReachable: {
      state: 'known',
      value: true,
      evidence: [{ kind: 'doc', url: DOC_MODELS_LIST }],
    },
    calledBySdk: {
      state: 'unknown',
      reason:
        'A MiniMax base URL-en mért route statisztika first-party úton nem alkalmazható, és a hivatalos leírás a first-party indulási fázisról nem mond semmit.',
      blockedBy: ['M-12'],
    },
    listedModelCount: {
      state: 'unknown',
      reason:
        'A lista lapozott és az Anthropic modellkínálatával együtt változik, ezért konkrét darabszám dokumentációból nem rögzíthető, mérés pedig nem készült ezen az úton.',
      blockedBy: ['M-12'],
    },
  },
  rateLimits: claudeSubscriptionRateLimits,
  concurrency: claudeSubscriptionConcurrency,
  anthropicBetaHeaders,
} satisfies ProviderCapabilityDescriptor<ClaudeModelId, ClaudeFamilyId>;
