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
// A motor teljes felülete és a `createEngine` összeállítás (SPEC-004 3.1
// szekció, PLAN-005 T-005-28): az `Engine` interfész, a négy eredmény típus
// (`ApprovalDecisionInput`, `ConcurrencySuggestion`, `ConnectionTestResult`,
// `ShutdownSummary`, `InterruptSummary`) és a `createEngine(dependencies)`
// factory, ami a kilenc portból felépíti a motoron belüli, megosztott
// állapotokat és visszaadja a hét metódusú felületet.
export type { Engine } from './engine-port/engine.ts';
export type { ApprovalDecisionInput } from './engine-port/approval-decision-input.ts';
export type { ConcurrencySuggestion } from './engine-port/concurrency-suggestion.ts';
export type { ConnectionTestResult } from './engine-port/connection-test-result.ts';
export type { InterruptSummary } from './engine-port/interrupt-summary.ts';
export type { ShutdownSummary } from './engine-port/shutdown-summary.ts';
export { createEngine } from './engine-port/create-engine.ts';

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

// run-validation: a futás indítási validációja. A SPEC-004 4.7 táblázatának
// mind a tíz ellenőrzése, a 4.2 fenntartott `branch_key` szabálya, a 4.8
// 2. lépésének node-onkénti provider feloldása, és a 4.7 "A validáció
// eredménye típusszintű szűkítés" bekezdésének `ExecutableNodeConfig` uniója
// (PLAN-005 T-005-15). A `validateRun` az egyetlen belépési pont; a
// tizenegy ellenőrző függvény azért is szerepel a barrelben, mert
// mindegyik önállóan futtatható, adatbázis nélküli tiszta függvény.
export type { ExecutableNodeConfig } from './run-validation/executable-node-config.ts';
export type { ValidatedRun } from './run-validation/validated-run.ts';
export { validateRun } from './run-validation/validate-run.ts';
export { validateStartNode } from './run-validation/validate-start-node.ts';
export { validateEdgeEndpoints } from './run-validation/validate-edge-endpoints.ts';
export { validateNodeReachability } from './run-validation/validate-node-reachability.ts';
export { validateNodeConfigs } from './run-validation/validate-node-configs.ts';
export { validateImplementedNodeTypes } from './run-validation/validate-implemented-node-types.ts';
export { validateBranchEdgeKeys } from './run-validation/validate-branch-edge-keys.ts';
export { validateDefaultBranchKey } from './run-validation/validate-default-branch-key.ts';
export { validateErrorHandlerEdges } from './run-validation/validate-error-handler-edges.ts';
// A 4.7 táblázaton kívüli, tizenegyedik config szintű ellenőrzés: a
// `backoffMs` lista hossza legalább `maxAttempts - 1` (SPEC-004 8.2 3. pont,
// `insufficient_backoff_list`, PLAN-005 T-005-24).
export { validateErrorHandlerBackoff } from './run-validation/validate-error-handler-backoff.ts';
export { validateUnhandledErrorPolicy } from './run-validation/validate-unhandled-error-policy.ts';
export { validateJoinMergeSettings } from './run-validation/validate-join-merge-settings.ts';
export { validateReservedBranchKeys } from './run-validation/validate-reserved-branch-keys.ts';
export { resolveNodeProviders } from './run-validation/resolve-node-providers.ts';

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

// run-context: a `RunContext` összeállítása és a `steps` hivatkozás feloldása
// ős példányokra (SPEC-004 6.1, 6.2, PLAN-005 T-005-16). A két exportált
// függvény ugyanazt a feloldási szabályt használja, más hibakezeléssel: a
// `buildRunContext` a fel nem oldható őst kihagyja a `steps` rekordból, a
// `resolveStepReference` viszont `unresolvable_step_reference` hibát ad, mert
// azt a `sub_workflow` `inputMapping` feloldása hívja (5.9 2. pont).
export type { RunContext } from './run-context/run-context.ts';
export type { StepInstanceReference } from './run-context/step-instance-reference.ts';
export type { ExecutedStepInstance } from './run-context/executed-step-instance.ts';
export type { BuildRunContextInput } from './run-context/build-run-context.ts';
export { buildRunContext } from './run-context/build-run-context.ts';
export { resolveStepReference } from './run-context/resolve-step-reference.ts';

// scheduling: a DAG ütemező tiszta, memóriában élő állapotgépe: a `live` és
// `dead` jelölések nyilvántartása élenként és ág kontextusonként, a
// futtathatóság eldöntése, a halott ág továbbterjesztése, a `fan_out`
// kibontás és a `loop` iterációszám vezetése, és az érkezési sorszám
// (SPEC-004 4.4, 4.5, 4.6, 7.1, PLAN-005 T-005-17). A téma egyetlen sora sem
// érint adatbázist és nem hív portot.
export type { EdgeMark } from './scheduling/edge-mark.ts';
export type { InstanceReadiness } from './scheduling/instance-readiness.ts';
export type { FanOutExpansion } from './scheduling/fan-out-expansion.ts';
export type { ReadyInstance } from './scheduling/ready-instance.ts';
export type { RunTopology } from './scheduling/run-topology.ts';
export type { SchedulerState } from './scheduling/scheduler-state.ts';
export type { SchedulingEvent } from './scheduling/scheduling-event.ts';
export { createSchedulerState } from './scheduling/create-scheduler-state.ts';
export { enqueueStartInstance } from './scheduling/enqueue-start-instance.ts';
export { advanceScheduler } from './scheduling/advance-scheduler.ts';
export { resolveInstanceReadiness } from './scheduling/resolve-instance-readiness.ts';
export { enqueueReadyInstance } from './scheduling/enqueue-ready-instance.ts';
export { takeNextReadyInstance } from './scheduling/take-next-ready-instance.ts';
export { isRunTerminal } from './scheduling/is-run-terminal.ts';
export { resolveLoopIteration } from './scheduling/resolve-loop-iteration.ts';
export { resolveFanOutItem } from './scheduling/resolve-fan-out-item.ts';
export { collectJoinInputs } from './scheduling/collect-join-inputs.ts';
export { buildFanOutItemContext } from './scheduling/build-fan-out-item-context.ts';
export { buildScopedKey } from './scheduling/build-scoped-key.ts';

// concurrency-gate: a providerenkénti, minden futásra közös, szigorúan
// érkezési sorrendű párhuzamossági szabályozó, a hely kérésével és
// felszabadításával (SPEC-004 7.1 ... 7.3, PLAN-005 T-005-18). A korlátot a
// `ConcurrencyLimitLookup` adja, tehát a téma egyetlen sora sem érint
// adatbázist, és nem szerepel benne párhuzamossági szám.
export type { ConcurrencyGate } from './concurrency-gate/concurrency-gate.ts';
export type { ConcurrencyLimitLookup } from './concurrency-gate/concurrency-limit-lookup.ts';
export { createConcurrencyGate } from './concurrency-gate/create-concurrency-gate.ts';

// agent-step: az agent lépés életciklusa (SPEC-004 5.2), a session modell
// (6.3, 6.4), a kimenő SDK `Options` összeállítása (11.3 táblázat) és a
// strukturált kimenet utóellenőrzése (PLAN-005 T-005-19). A téma nem kér
// párhuzamossági helyet és nem vált `step_run` állapotot, lásd
// `packages/engine/CLAUDE.md`.
export type { SessionBearingInstance } from './agent-step/session-bearing-instance.ts';
export type { SessionSourceNodes } from './agent-step/session-source-nodes.ts';
export type { SessionBinding } from './agent-step/session-binding.ts';
export type { StopHookMatcher } from './agent-step/stop-hook-matcher.ts';
export type { AgentStepOptions } from './agent-step/agent-step-options.ts';
export type { AgentStepCapabilityDecisions } from './agent-step/agent-step-capability-decisions.ts';
export type { AgentStepOutcome } from './agent-step/agent-step-outcome.ts';
export type { AgentStepExecution } from './agent-step/agent-step-execution.ts';
export type { AgentStepRequest } from './agent-step/agent-step-request.ts';
export type { AgentStreamMessage } from './agent-step/agent-stream-message.ts';
export type { ResultTelemetry } from './agent-step/result-telemetry.ts';
export { collectSessionSourceNodes } from './agent-step/collect-session-source-nodes.ts';
export { resolveForkSession } from './agent-step/resolve-fork-session.ts';
export { findNearestAncestorSession } from './agent-step/find-nearest-ancestor-session.ts';
export type { ResolveSessionBindingInput } from './agent-step/resolve-session-binding.ts';
export { resolveSessionBinding } from './agent-step/resolve-session-binding.ts';
export type {
  AgentStepCapabilityOutcome,
  AgentStepDescriptorFields,
} from './agent-step/validate-agent-step-capabilities.ts';
export { validateAgentStepCapabilities } from './agent-step/validate-agent-step-capabilities.ts';
export { buildStopHookMatcher } from './agent-step/build-stop-hook-matcher.ts';
export type { BuildAgentStepOptionsInput } from './agent-step/build-agent-step-options.ts';
export { buildAgentStepOptions } from './agent-step/build-agent-step-options.ts';
export { readResultTelemetry } from './agent-step/read-result-telemetry.ts';
export { runAgentStep } from './agent-step/run-agent-step.ts';

// node-executor: a diszpécser és a tíz végrehajtható node típus végrehajtója
// (SPEC-004 5. szekció, PLAN-005 T-005-20 ... T-005-24). A T-005-20 az öt
// nem-agent típus végrehajtóját adta (`start`, `branch`, `fan_out`, `loop`,
// `join` `merge`) a közös, megosztott infrastruktúrával. **A T-005-21 ehhez
// hozzátette az `agent_step` és a `join` `ai_synthesis` végrehajtóját**, a
// közös `agent-node-lifecycle.ts` menettel és a hely kérésével/
// felszabadításával (7. szekció) - ez a téma belső segéde, nincs a barrelben.
// **A T-005-22 hozzátette a `human_approval` végrehajtóját**, a korlátlan és
// a korlátos várakozással (5.8), plusz a döntésre várás
// `ApprovalWaitRegistry`-jét. **A T-005-24 zárta le a témát**: az
// `error_handler` végrehajtójával és a kimerítő `switch`-es diszpécserrel
// (`executeNode`), ami mind a tíz végrehajtható node típust lefedi.
export type { NodeExecutorPorts } from './node-executor/node-executor-ports.ts';
export type { NodeExecutionInstance } from './node-executor/node-executor-instance.ts';
export type { NodeExecutionOutcome } from './node-executor/node-executor-outcome.ts';
export { emitEngineEvent } from './node-executor/emit-engine-event.ts';
export type { BeganStepRun } from './node-executor/begin-step-run.ts';
export { beginStepRun } from './node-executor/begin-step-run.ts';
export type { FinishStepRunSucceededInput } from './node-executor/finish-step-run-succeeded.ts';
export { finishStepRunSucceeded } from './node-executor/finish-step-run-succeeded.ts';
export type { FinishStepRunFailedInput } from './node-executor/finish-step-run-failed.ts';
export { finishStepRunFailed } from './node-executor/finish-step-run-failed.ts';
export type { ExecuteStartInput } from './node-executor/execute-start.ts';
export { executeStart } from './node-executor/execute-start.ts';
export type { ExecuteBranchInput } from './node-executor/execute-branch.ts';
export { executeBranch } from './node-executor/execute-branch.ts';
export type { ExecuteFanOutInput } from './node-executor/execute-fan-out.ts';
export { executeFanOut } from './node-executor/execute-fan-out.ts';
export type { ExecuteLoopInput } from './node-executor/execute-loop.ts';
export { executeLoop } from './node-executor/execute-loop.ts';
export type { ExecuteJoinMergeInput } from './node-executor/execute-join-merge.ts';
export { executeJoinMerge } from './node-executor/execute-join-merge.ts';
export type { ExecuteAgentStepInput } from './node-executor/execute-agent-step.ts';
export { executeAgentStep } from './node-executor/execute-agent-step.ts';
export type { ExecuteJoinAiSynthesisInput } from './node-executor/execute-join-ai-synthesis.ts';
export { executeJoinAiSynthesis } from './node-executor/execute-join-ai-synthesis.ts';
// T-005-22: a `human_approval` végrehajtó, plusz a döntésre várás
// regisztere (`ApprovalWaitRegistry`, SPEC-004 5.8, "Az időkorlát verseny").
// A `createApprovalWaitRegistry` a hívó (jövőbeli `run-supervisor`,
// T-005-25) által EGYETLEN példányban létrehozandó, minden futás által
// megosztott állapot - ugyanaz a minta, mint a `createConcurrencyGate`.
export type { ApprovalWaitRegistry } from './node-executor/approval-wait-registry.ts';
export { createApprovalWaitRegistry } from './node-executor/approval-wait-registry.ts';
export type { ExecuteHumanApprovalInput } from './node-executor/execute-human-approval.ts';
export { executeHumanApproval } from './node-executor/execute-human-approval.ts';
// T-005-23: a `sub_workflow` végrehajtó (SPEC-004 5.9), az ancestry alapú
// rekurzióvédelem tiszta függvénye, és a `ChildWorkflowRunner` port alakú,
// motoron BELÜLI függőség, amit a `run-supervisor` (T-005-25) önmagára
// hivatkozva tölt majd ki - a kilenc befecskendezett portnak NEM tagja.
export type {
  ChildWorkflowRunner,
  ChildWorkflowRunRequest,
  ChildWorkflowRunResult,
} from './node-executor/child-workflow-runner.ts';
export { detectWorkflowRecursion } from './node-executor/detect-workflow-recursion.ts';
export type { ExecuteSubWorkflowInput } from './node-executor/execute-sub-workflow.ts';
export { executeSubWorkflow } from './node-executor/execute-sub-workflow.ts';
// T-005-24: az `error_handler` végrehajtója (SPEC-004 8.2), és a téma VÉGSŐ,
// kimerítő diszpécsere (`executeNode`), ami mind a tíz végrehajtható node
// típust lefedi (a `join` két módjával kilenc `switch` ág, plusz az
// `error_handler` külön diszkriminált kérés ága). Ez a `run-supervisor`
// (T-005-25) belépési pontja egy futtathatónak talált node PÉLDÁNY
// végrehajtásához.
export type { ExecuteErrorHandlerInput } from './node-executor/execute-error-handler.ts';
export { executeErrorHandler } from './node-executor/execute-error-handler.ts';
export type { NodeExecutorDependencies } from './node-executor/node-executor-dependencies.ts';
export type { ExecuteNodeRequest } from './node-executor/execute-node-request.ts';
export { executeNode } from './node-executor/execute-node.ts';

// error-policy: az `on_error` útvonal, az `error_handler` kísérlet vezérlése,
// a `fail_run` és a `fail_branch` politika, és a futás záró állapota
// (SPEC-004 8.1 ... 8.4, PLAN-005 T-005-24). Tiszta függvények: a téma
// egyetlen sora sem érint adatbázist, nem hív portot és nem szakít meg
// futó lépést - csak kimondja a döntést, amit a `run-supervisor` (T-005-25)
// hajt végre.
export type { ErrorRoute } from './error-policy/error-route.ts';
export type { FailureEscapeKey, ResolveErrorRouteInput } from './error-policy/resolve-error-route.ts';
export { resolveErrorRoute } from './error-policy/resolve-error-route.ts';
export type { RetryDecision } from './error-policy/retry-decision.ts';
export type { ResolveRetryDecisionInput } from './error-policy/resolve-retry-decision.ts';
export { resolveRetryDecision } from './error-policy/resolve-retry-decision.ts';
export type { UnhandledErrorRecord } from './error-policy/unhandled-error-record.ts';
export type { RunCompletion } from './error-policy/run-completion.ts';
export { resolveRunCompletion } from './error-policy/resolve-run-completion.ts';

// run-supervisor: a futás életciklusa (SPEC-004 4.8, 4.4 ... 4.6, 8.4,
// PLAN-005 T-005-25). A `createRunSupervisor` az egyetlen belépési pont: a
// 4.8 menetét futtatja, háttérben lépteti a futást a terminális állapotig, és
// ÖNMAGÁT adja át `ChildWorkflowRunner`-ként a `sub_workflow` végrehajtónak.
// A 4.8 egyes lépései külön, önmagukban tesztelhető függvények, ezért a
// barrelben is szerepelnek.
export type {
  StartRunRequest,
  StartedRun,
  RunSupervisor,
  RunSupervisorDependencies,
} from './run-supervisor/run-supervisor.ts';
export type { NodePlan, PendingFailure, RunExecution } from './run-supervisor/run-execution.ts';
export type { ActiveRunHandle, ActiveRunRegistry } from './run-supervisor/active-run-registry.ts';
export { createActiveRunRegistry } from './run-supervisor/active-run-registry.ts';
export type { BuildSnapshotDocumentInput } from './run-supervisor/build-snapshot-document.ts';
export { buildSnapshotDocument } from './run-supervisor/build-snapshot-document.ts';
export { buildNodePlans } from './run-supervisor/build-node-plans.ts';
export { validateRunInput } from './run-supervisor/validate-run-input.ts';
export { validateProviderCapabilities } from './run-supervisor/validate-provider-capabilities.ts';
export type { RunInputs } from './run-supervisor/collect-run-inputs.ts';
export { collectRunInputs } from './run-supervisor/collect-run-inputs.ts';
export type { PrepareRunInput } from './run-supervisor/prepare-run.ts';
export { prepareRun } from './run-supervisor/prepare-run.ts';
export { buildChildResult } from './run-supervisor/build-child-result.ts';
export { collectTerminalOutput } from './run-supervisor/collect-terminal-output.ts';
export { advanceRun } from './run-supervisor/advance-run.ts';
export { createRunSupervisor } from './run-supervisor/create-run-supervisor.ts';
// A `restartRun` motor művelet (SPEC-004 3.1 `Engine` felület, 9. szekció
// zárómondata, SPEC-003 27. kritérium, PLAN-005 T-005-27): a `startRun`
// menetét hívja ÚJRA az eredeti futás workflowId-jével és input-jával, a
// `restartedFromRunId` mezővel kiegészítve - a workflow AKTUÁLIS gráfját a
// `startRun` amúgy is mindig frissen olvassa.
export type { RestartRunDependencies } from './run-supervisor/restart-run.ts';
export { restartRun } from './run-supervisor/restart-run.ts';

// run-interrupt: a felhasználói megszakítás ÉS a szabályos leállás közös
// menete (SPEC-004 9. és 10.2 szekció, PLAN-005 T-005-26, T-005-27). Az
// `AgentQueryRegistry` az élő `AgentQuery` objektumok nyilvántartása, amit az
// `agent-step` téma tölt (a `agentQueryRunner.run(...)` hívás után azonnal),
// és amit az `interruptRun` és a `shutdownActiveRuns` is kérdez le. A
// `stopAndAwaitRunTree` a megszakítás 2 ... 4. pontjának (`requestStop`,
// `interrupt`, a `completion` megvárása) közös, mindkét belépési pont által
// újrahasznált menete; a DB oldali zárás témánként eltér (`interruptRun` a
// `cancelRunTree`, `shutdownActiveRuns` a `recoverInterruptedRuns`
// primitívvel).
export type { AgentQueryRegistry } from './run-interrupt/agent-query-registry.ts';
export { createAgentQueryRegistry } from './run-interrupt/agent-query-registry.ts';
export { stopAndAwaitRunTree } from './run-interrupt/stop-and-await-run-tree.ts';
export type { InterruptRunDependencies, InterruptRunResult } from './run-interrupt/interrupt-run.ts';
export { interruptRun } from './run-interrupt/interrupt-run.ts';
// A szabályos leállás (SPEC-004 10.2 szekció, PLAN-005 T-005-27): a
// `shutdownActiveRuns` a `stopAndAwaitRunTree`-t MINDEN aktív futásra
// lefuttatja, majd a `db` `recoverInterruptedRuns('graceful_shutdown')`
// hívásával zár - lásd a `startup-recovery` témát is, ami ugyanezt a `db`
// függvényt hívja `'startup_recovery'` értékkel.
export type { ShutdownActiveRunsDependencies } from './run-interrupt/shutdown-active-runs.ts';
export { shutdownActiveRuns } from './run-interrupt/shutdown-active-runs.ts';

// startup-recovery: a `RunRecovery.recoverInterruptedRuns()` (MÁR KÉSZ `db`
// réteg) VÉKONY burkolása a motor oldalán (SPEC-004 10.1 szekció, PLAN-005
// T-005-27, AC-53). Ez a `packages/engine/src` alatti 18., egyben utolsó
// téma mappa (SPEC-004 12. szekció).
export { runStartupRecovery } from './startup-recovery/run-startup-recovery.ts';
