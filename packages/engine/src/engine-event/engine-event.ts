import type { RunStartedPayload } from './run-started-payload.ts';
import type { RunFinishedPayload } from './run-finished-payload.ts';
import type { RunInterruptedPayload } from './run-interrupted-payload.ts';
import type { StepStartedPayload } from './step-started-payload.ts';
import type { StepFinishedPayload } from './step-finished-payload.ts';
import type { BranchTakenPayload } from './branch-taken-payload.ts';
import type { FanOutExpandedPayload } from './fan-out-expanded-payload.ts';
import type { JoinResolvedPayload } from './join-resolved-payload.ts';
import type { LoopIterationStartedPayload } from './loop-iteration-started-payload.ts';
import type { ApprovalRequestedPayload } from './approval-requested-payload.ts';
import type { ApprovalDecidedPayload } from './approval-decided-payload.ts';
import type { SubWorkflowStartedPayload } from './sub-workflow-started-payload.ts';
import type { SubWorkflowFinishedPayload } from './sub-workflow-finished-payload.ts';

/**
 * Közös alak minden `EngineEvent` ághoz: a diszkriminátor `kind`, a
 * `stepRunId` futás vs. lépés szintű megszorítása (`null` a futás szintű
 * eseményeknél, `string` a lépés szintűeknél) és a hozzá tartozó payload
 * típus. Nem exportált: kizárólag az `EngineEvent` unió belső segédje.
 */
interface EngineEventBase<TKind extends string, TStepRunId extends string | null, TPayload> {
  readonly kind: TKind;
  readonly runId: string;
  readonly stepRunId: TStepRunId;
  readonly payload: TPayload;
}

/**
 * A 13, motor eredetű `run_event` `kind` érték diszkriminált uniója
 * (SPEC-004 13. szekció táblázata). A `run_started`, `run_finished` és
 * `run_interrupted` futás szintű: a `stepRunId` mindig `null`. A többi tíz
 * lépés szintű: a `stepRunId` mindig `string`.
 *
 * **Az `sdk_context_usage` kind szándékosan hiányzik** (F-17, SPEC-004 13.
 * szekció megjegyzés): a motor erre a `kind`-ra sosem ír sort, tehát ez az
 * unió nem is ad neki ágat.
 */
export type EngineEvent =
  | EngineEventBase<'run_started', null, RunStartedPayload>
  | EngineEventBase<'run_finished', null, RunFinishedPayload>
  | EngineEventBase<'run_interrupted', null, RunInterruptedPayload>
  | EngineEventBase<'step_started', string, StepStartedPayload>
  | EngineEventBase<'step_finished', string, StepFinishedPayload>
  | EngineEventBase<'branch_taken', string, BranchTakenPayload>
  | EngineEventBase<'fan_out_expanded', string, FanOutExpandedPayload>
  | EngineEventBase<'join_resolved', string, JoinResolvedPayload>
  | EngineEventBase<'loop_iteration_started', string, LoopIterationStartedPayload>
  | EngineEventBase<'approval_requested', string, ApprovalRequestedPayload>
  | EngineEventBase<'approval_decided', string, ApprovalDecidedPayload>
  | EngineEventBase<'sub_workflow_started', string, SubWorkflowStartedPayload>
  | EngineEventBase<'sub_workflow_finished', string, SubWorkflowFinishedPayload>;
