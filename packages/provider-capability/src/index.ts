// Barrel: csak újraexport, a csomag publikus felülete csak azt adja ki, amire másik csomagnak szüksége van.

// evidence: a háromállapotú bizonyíték típus és a hivatkozás oldala.
export type { MeasurementId } from './evidence/evidence-reference/measurement-id.ts';
export type { EvidenceReference } from './evidence/evidence-reference/evidence-reference.ts';
export type { EvidenceList } from './evidence/evidence-reference/evidence-list.ts';
export type { Fact } from './evidence/fact/fact.ts';
export { isKnownFact } from './evidence/fact/is-known-fact.ts';
export { isUnknownFact } from './evidence/fact/is-unknown-fact.ts';

// evidence-sources: a bizonyítékok nevesített forráskatalógusa.
export {
  DOC_ENV_VARS,
  DOC_MODEL_CONFIG,
  DOC_MODELS,
  DOC_MODELS_LIST,
  DOC_TOOL_USE,
  DOC_WEB_SEARCH,
  DOC_STRUCTURED,
  DOC_EFFORT,
  DOC_THINKING,
  DOC_THINKING_STEER,
  DOC_CACHING,
  DOC_STREAMING,
  DOC_VISION,
  DOC_MINIMAX_ANTHROPIC_API,
  DOC_MINIMAX_OPENAI_API,
  DOC_MINIMAX_CHAT_OPENAI,
  DOC_MINIMAX_TEXT_GENERATION,
  DOC_MINIMAX_RATE_LIMITS,
  DOC_MINIMAX_CLAUDE_CODE_M_PLAN,
  DOC_MINIMAX_CLAUDE_CODE_TOKEN_PLAN,
} from './evidence-sources/measurement-document/document-url.ts';
export {
  RESEARCH_MINIMAX,
  RESEARCH_GATEWAY,
  RESEARCH_AUTH_PRECEDENCE,
  RESEARCH_MINIMAX_FLASH,
} from './evidence-sources/measurement-document/research-section.ts';
export type { MeasurementDocumentAnchor } from './evidence-sources/measurement-document/measurement-document.ts';
export { measurementDocument } from './evidence-sources/measurement-document/measurement-document.ts';

// provider-id: a két támogatott provider azonosítója és a hozzá tartozó guard.
export type { ProviderId } from './provider-id/provider-id.ts';
export { isProviderId } from './provider-id/is-provider-id.ts';

export type { ProviderCapabilityDescriptor } from './descriptor/provider-capability-descriptor.ts';

export type { ModelDescriptor } from './model-catalog/model-descriptor.ts';
export type { ModelsEndpointCapability } from './model-catalog/models-endpoint-capability.ts';

export type { EnvironmentRequirement } from './environment/environment-requirement.ts';
export type { DisallowedEnvironmentRequirement } from './environment/disallowed-environment-requirement.ts';

export type { ServerToolDescriptor } from './tool-support/server-tool-descriptor.ts';

export type { ConcurrencyCapability } from './limits/concurrency-capability.ts';
export type { RateLimitCapability } from './limits/rate-limit-capability.ts';
export type { RateLimitBucket } from './limits/rate-limit-bucket.ts';

export type { EffortCapability } from './request-shaping/effort-capability.ts';
export type { ThinkingCapability } from './request-shaping/thinking-capability.ts';
export type { ThinkingMode } from './request-shaping/thinking-mode.ts';
export type { ToolChoiceCapability } from './request-shaping/tool-choice-capability.ts';
export type { ToolChoiceValue } from './request-shaping/tool-choice-value.ts';
export type { StructuredOutputCapability } from './request-shaping/structured-output-capability.ts';
export type { StructuredOutputStrategy } from './request-shaping/structured-output-strategy.ts';
export type { StructuredOutputStrategyId } from './request-shaping/structured-output-strategy-id.ts';
export type { StreamingCapability } from './request-shaping/streaming-capability.ts';
export type { PromptCachingCapability } from './request-shaping/prompt-caching-capability.ts';
export type { PromptCacheMode } from './request-shaping/prompt-cache-mode.ts';
