import type { Fact } from '../evidence/fact.ts';
import type { ConcurrencyCapability } from './concurrency-capability.ts';
import type { DisallowedEnvironmentRequirement } from './disallowed-environment-requirement.ts';
import type { EffortCapability } from './effort-capability.ts';
import type { EnvironmentRequirement } from './environment-requirement.ts';
import type { ModelDescriptor } from './model-descriptor.ts';
import type { ModelsEndpointCapability } from './models-endpoint-capability.ts';
import type { PromptCachingCapability } from './prompt-caching-capability.ts';
import type { RateLimitCapability } from './rate-limit-capability.ts';
import type { ServerToolDescriptor } from './server-tool-descriptor.ts';
import type { StreamingCapability } from './streaming-capability.ts';
import type { StructuredOutputCapability } from './structured-output-capability.ts';
import type { ThinkingCapability } from './thinking-capability.ts';
import type { ToolChoiceCapability } from './tool-choice-capability.ts';

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
  readonly models: readonly ModelDescriptor<TModelId, TFamilyId>[];
  readonly modelsEndpoint: ModelsEndpointCapability;
  readonly rateLimits: RateLimitCapability<TModelId>;
  readonly concurrency: ConcurrencyCapability;
  /**
  Q12: a kimenő `anthropic-beta` header elemei.
  */
  readonly anthropicBetaHeaders: Fact<readonly string[]>;
}
