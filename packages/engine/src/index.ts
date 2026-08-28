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

// engine-event: a 13, motor eredetű `run_event` `kind` payload alakja, az
// összefogó `EngineEvent` diszkriminált unió és a motor esemény író
// (SPEC-004 13. szekció, PLAN-005 T-005-9).
export type { RunStartedPayload } from './engine-event/run-started-payload.ts';
export type { RunFinishedPayload } from './engine-event/run-finished-payload.ts';
export type { RunInterruptedPayload } from './engine-event/run-interrupted-payload.ts';
export type { StepStartedPayload } from './engine-event/step-started-payload.ts';
export type { StepFinishedPayload } from './engine-event/step-finished-payload.ts';
export type { BranchTakenPayload } from './engine-event/branch-taken-payload.ts';
export type { FanOutExpandedPayload } from './engine-event/fan-out-expanded-payload.ts';
export type { JoinResolvedPayload } from './engine-event/join-resolved-payload.ts';
export type { LoopIterationStartedPayload } from './engine-event/loop-iteration-started-payload.ts';
export type { ApprovalRequestedPayload } from './engine-event/approval-requested-payload.ts';
export type { ApprovalDecidedPayload } from './engine-event/approval-decided-payload.ts';
export type { SubWorkflowStartedPayload } from './engine-event/sub-workflow-started-payload.ts';
export type { SubWorkflowFinishedPayload } from './engine-event/sub-workflow-finished-payload.ts';
export type { EngineEvent } from './engine-event/engine-event.ts';
export { writeEngineEvent } from './engine-event/write-engine-event.ts';

// run-graph: az `ExecutableGraph` felépítése a pillanatképből, a visszaél
// keresés, a kör keresés a visszaélek elhagyása után, a `loop` node alakjának
// két ellenőrzése és az elérhetőség számítás (SPEC-004 4.1, 4.6,
// PLAN-005 T-005-10).
export type { ExecutableGraph } from './run-graph/executable-graph.ts';
export { buildExecutableGraph } from './run-graph/build-executable-graph.ts';
export { computeReachableNodeIds } from './run-graph/compute-reachable-node-ids.ts';
export { findLoopBackEdges } from './run-graph/find-loop-back-edges.ts';
export { detectGraphCycle } from './run-graph/detect-graph-cycle.ts';
export { validateLoopBackEdgeBody } from './run-graph/validate-loop-back-edge-body.ts';
export { validateLoopBranchEdges } from './run-graph/validate-loop-branch-edges.ts';

// branch-scope: a futáskori hatókör verem típusa, a statikus, validációs
// párja, a hatókör kiegyensúlyozottság ellenőrzése és a belőle levezetett
// fan-out/join párosítás (SPEC-004 4.3, 4.5, PLAN-005 T-005-11).
export type { BranchScope, BranchContext } from './branch-scope/branch-scope.ts';
export type { StaticScopeFrame, StaticScopeStack } from './branch-scope/static-scope-stack.ts';
export type { FanOutJoinPairing } from './branch-scope/fan-out-join-pairing.ts';
export { validateScopeBalance } from './branch-scope/validate-scope-balance.ts';

// provider-resolution: a háromszintű provider feloldás (SPEC-004 11.1,
// PLAN-005 T-005-12).
export { resolveEffectiveProvider } from './provider-resolution/resolve-effective-provider.ts';

// capability-policy: a `Fact` három állapotának egységes kezelése, és a
// SPEC-004 11.3 táblázat leírótól függő viselkedései, viselkedésenként egy
// tiszta függvényben (SPEC-004 11.2, 11.3, PLAN-005 T-005-13).
//
// A táblázat tizenhat leírótól függő sorából tizennégy áll itt. A hiányzó
// kettő, a kötelező env blokk (10. sor) és a tiltott env változók levétele
// (11. sor) a `provider-environment` téma dolga (PLAN-005 T-005-14), mert
// azok a `processEnvironment` porton át olvasnak, nem tiszta leíró döntések.
// A táblázat 2. sora (kell-e a `Stop` hook) nem leíró mező, hanem a
// stratégia választás következménye, ezért az `Options` összeállításához
// tartozik (`agent-step` téma, T-005-19).
export type { CapabilityFieldInclusion } from './capability-policy/capability-field-inclusion.ts';
export type { ConnectionTestMode } from './capability-policy/connection-test-mode.ts';
export type { StructuredOutputStrategyDecision } from './capability-policy/structured-output-strategy-decision.ts';
export type { ModelIdentifierDecision } from './capability-policy/model-identifier-decision.ts';
export type { DisallowedServerToolsDecision } from './capability-policy/disallowed-server-tools-decision.ts';
export { resolveStructuredOutputStrategy } from './capability-policy/resolve-structured-output-strategy.ts';
export { validateMaxTurnsFloor } from './capability-policy/validate-max-turns-floor.ts';
export { validateForcedToolChoiceRisk } from './capability-policy/validate-forced-tool-choice-risk.ts';
export { resolveModelWireIdentifier } from './capability-policy/resolve-model-wire-identifier.ts';
export { requireModelSelection } from './capability-policy/require-model-selection.ts';
export { validateModelId } from './capability-policy/validate-model-id.ts';
export { resolveThinkingMode } from './capability-policy/resolve-thinking-mode.ts';
export { resolveEffortInclusion } from './capability-policy/resolve-effort-inclusion.ts';
export { resolveDisallowedServerTools } from './capability-policy/resolve-disallowed-server-tools.ts';
export { shouldIncludePartialMessages } from './capability-policy/should-include-partial-messages.ts';
export { resolveConcurrencySuggestion } from './capability-policy/resolve-concurrency-suggestion.ts';
export { RATE_LIMIT_RETRY_POLICY } from './capability-policy/rate-limit-retry-policy.ts';
export { resolveConnectionTestMode } from './capability-policy/resolve-connection-test-mode.ts';
export { validateSdkVersionMatch } from './capability-policy/validate-sdk-version-match.ts';

// provider-environment: a SPEC-004 11.3 táblázat 10. és 11. sora, a
// `requiredEnv` és a `disallowedEnv` feldolgozása a `processEnvironment`
// porton át, a lépés kimenő `Options.env` blokkjának összeállítása
// (PLAN-005 T-005-14).
export { buildProviderEnvironmentBlock } from './provider-environment/build-provider-environment-block.ts';
export { resolveRequiredEnvironmentValue } from './provider-environment/resolve-required-environment-value.ts';
