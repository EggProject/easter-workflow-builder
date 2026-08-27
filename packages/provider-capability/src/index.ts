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
} from './evidence-sources/measurement-document/document-url.ts';
export { RESEARCH_MINIMAX, RESEARCH_GATEWAY } from './evidence-sources/measurement-document/research-section.ts';
export type { MeasurementDocumentAnchor } from './evidence-sources/measurement-document/measurement-document.ts';
export { measurementDocument } from './evidence-sources/measurement-document/measurement-document.ts';

// agent-tool-id: a workflow lépéshez kapcsolható in-process MCP eszközök közös szótára.
export type { AgentToolId } from './agent-tool-id/agent-tool-id.ts';

// provider-id: a két támogatott provider azonosítója.
export type { ProviderId } from './provider-id/provider-id.ts';

export type { ProviderCapabilityDescriptor } from './descriptor/provider-capability-descriptor.ts';

export type { ModelDescriptor } from './model-catalog/model-descriptor.ts';
export type { ModelsEndpointCapability } from './model-catalog/models-endpoint-capability.ts';

export type { EnvironmentRequirement } from './environment/environment-requirement.ts';
export type { DisallowedEnvironmentRequirement } from './environment/disallowed-environment-requirement.ts';

export type { ServerToolDescriptor } from './tool-support/server-tool-descriptor.ts';
export type { AgentToolRecommendation } from './tool-support/agent-tool-recommendation.ts';

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
