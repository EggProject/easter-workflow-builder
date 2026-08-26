import type { ProviderCapabilityDescriptor } from '../capability/provider-capability-descriptor.ts';
import type { Fact } from '../evidence/fact.ts';
import { DOC_MODELS_LIST } from '../references/document-url.ts';
import { claudeSubscriptionConcurrency } from './concurrency.ts';
import { claudeSubscriptionDisallowedEnvironment } from './disallowed-environment.ts';
import { claudeSubscriptionEffort } from './effort.ts';
import type { ClaudeFamilyId } from './family-id.ts';
import type { ClaudeModelId } from './model-id.ts';
import { claudeSubscriptionModels } from './models.ts';
import { claudeSubscriptionPromptCaching } from './prompt-caching.ts';
import { claudeSubscriptionRateLimits } from './rate-limits.ts';
import { claudeSubscriptionRequiredEnvironment } from './required-environment.ts';
import { claudeSubscriptionServerTools } from './server-tools.ts';
import { claudeSubscriptionStreaming } from './streaming.ts';
import { claudeSubscriptionStructuredOutput } from './structured-output.ts';
import { claudeSubscriptionThinking } from './thinking.ts';
import { claudeSubscriptionToolChoice } from './tool-choice.ts';

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
