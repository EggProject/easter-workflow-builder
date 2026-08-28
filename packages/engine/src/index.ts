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
