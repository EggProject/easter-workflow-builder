import type { Outcome } from '@easter-workflow-builder/core';
import type { WorkflowRepository } from '../workflow-graph/workflow-repository.ts';
import type { WorkflowRunRepository } from '../workflow-run/workflow-run-repository.ts';
import type { StepRunRepository } from '../step-run/step-run-repository.ts';
import type { AppSettingRepository } from '../app-setting/app-setting-repository.ts';
import type { ProviderConcurrencyRepository } from '../provider-concurrency/provider-concurrency-repository.ts';
import type { RunEventRepository } from '../run-event/run-event-repository.ts';
import type { HumanApprovalRepository } from '../human-approval/human-approval-repository.ts';

/**
 * Az adatbázis kapcsolat felülete. A `workflows` mező a `WorkflowRepository`-t
 * (T-003-12), a `runs` mező a `WorkflowRunRepository`-t (T-003-16), a
 * `stepRuns` mező a `StepRunRepository`-t adja (T-003-18), a `settings` mező
 * az `AppSettingRepository`-t, a `concurrencyLimits` mező a
 * `ProviderConcurrencyRepository`-t adja (T-003-23), az `events` mező a
 * `RunEventRepository`-t (T-003-21), az `approvals` mező a
 * `HumanApprovalRepository`-t (T-003-22); a `recovery` mező a következő
 * téma (`run-recovery`) elkészültével bővül ide, a SPEC-003 9.1 szekció
 * `DatabaseContext` alakja szerint.
 */
export interface DatabaseContext {
  readonly workflows: WorkflowRepository;
  readonly runs: WorkflowRunRepository;
  readonly stepRuns: StepRunRepository;
  readonly events: RunEventRepository;
  readonly approvals: HumanApprovalRepository;
  readonly settings: AppSettingRepository;
  readonly concurrencyLimits: ProviderConcurrencyRepository;
  transaction<TValue>(work: () => Outcome<TValue>): Outcome<TValue>;
  close(): void;
}
