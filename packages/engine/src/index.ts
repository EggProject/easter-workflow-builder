// Barrel: csak nevesített újraexport. A csomag téma mappánként bővül, ahogy a
// PLAN-005 végrehajtási lépései elkészülnek.

// engine-port: a kilenc befecskendezett port típusa és az összefogó
// `EngineDependencies` (SPEC-004 3.2, 3.3).
export type { DatabaseContext } from './engine-port/database-port.ts';
export type { AgentQueryRunner } from './engine-port/agent-query-runner-port.ts';
export type { ProviderDescriptorLookupPort } from './engine-port/provider-descriptor-lookup-port.ts';
export type { ExpressionEvaluatorPort } from './engine-port/expression-evaluator-port.ts';
export type { TemplateRendererPort } from './engine-port/template-renderer-port.ts';
export type { EventPublisherPort } from './engine-port/event-publisher-port.ts';
export type { ClockPort } from './engine-port/clock-port.ts';
export type { IdGeneratorPort } from './engine-port/id-generator-port.ts';
export type { ProcessEnvironmentPort } from './engine-port/process-environment-port.ts';
export type { EngineDependencies } from './engine-port/engine-dependencies.ts';

// engine-error: a motor hibaosztályainak zárt szótára, a guardja és a
// hibaüzenet formázója (SPEC-004 4.2, 4.5, 4.6, 4.7, 4.8, 5., 6.2, 6.3, 8.2,
// 8.3, 11.1, 11.3, 15. O-1, PLAN-005 T-005-14).
export type { EngineErrorKind } from './engine-error/engine-error-kind.ts';
export { isEngineErrorKind } from './engine-error/is-engine-error-kind.ts';
export { formatEngineErrorMessage } from './engine-error/format-engine-error-message.ts';
