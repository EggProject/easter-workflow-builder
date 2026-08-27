import type { Fact } from '@easter-workflow-builder/evidence';
import type { AgentToolRecommendation } from '../tool-support/agent-tool-recommendation.ts';
import type { ConcurrencyCapability } from '../limits/concurrency-capability.ts';
import type { DisallowedEnvironmentRequirement } from '../environment/disallowed-environment-requirement.ts';
import type { EffortCapability } from '../request-shaping/effort-capability.ts';
import type { EnvironmentRequirement } from '../environment/environment-requirement.ts';
import type { ModelDescriptor } from '../model-catalog/model-descriptor.ts';
import type { ModelsEndpointCapability } from '../model-catalog/models-endpoint-capability.ts';
import type { PromptCachingCapability } from '../request-shaping/prompt-caching-capability.ts';
import type { RateLimitCapability } from '../limits/rate-limit-capability.ts';
import type { ServerToolDescriptor } from '../tool-support/server-tool-descriptor.ts';
import type { StreamingCapability } from '../request-shaping/streaming-capability.ts';
import type { StructuredOutputCapability } from '../request-shaping/structured-output-capability.ts';
import type { ThinkingCapability } from '../request-shaping/thinking-capability.ts';
import type { ToolChoiceCapability } from '../request-shaping/tool-choice-capability.ts';

/**
 * Egy provider drótszintű képességeinek leírója. Minden képességmező `Fact<T>`
 * burkolóban van, tehát bizonyíték nélkül nem tölthető ki. A modellazonosító és
 * a modellcsalád generikus paraméter, hogy minden provider a saját, szűk
 * literál uniójával dolgozzon.
 */
export interface ProviderCapabilityDescriptor<TModelId extends string, TFamilyId extends string> {
  readonly id: 'claude-subscription' | 'minimax';
  readonly displayName: string;
  /**
  Az SDK verzió, amivel a leíró érvényes. Frissítés előtt regresszió kell.
  */
  readonly sdkVersionPin: string;
  readonly measuredAt: string;
  readonly requiredEnv: readonly EnvironmentRequirement[];
  readonly disallowedEnv: readonly DisallowedEnvironmentRequirement[];
  readonly structuredOutput: StructuredOutputCapability;
  readonly toolChoice: ToolChoiceCapability;
  readonly thinking: ThinkingCapability<TFamilyId>;
  readonly effort: EffortCapability;
  readonly promptCaching: PromptCachingCapability;
  readonly streaming: StreamingCapability;
  readonly serverTools: Fact<readonly ServerToolDescriptor[]>;
  /**
  Mely saját folyamatban futó eszközt ajánlott bekapcsolni ennél a providernél.
  */
  readonly recommendedAgentTools: Fact<readonly AgentToolRecommendation[]>;
  readonly models: readonly ModelDescriptor<TModelId, TFamilyId>[];
  readonly modelsEndpoint: ModelsEndpointCapability;
  readonly rateLimits: RateLimitCapability<TModelId>;
  readonly concurrency: ConcurrencyCapability;
  /**
  Q12: a kimenő `anthropic-beta` header elemei.
  */
  readonly anthropicBetaHeaders: Fact<readonly string[]>;
}
