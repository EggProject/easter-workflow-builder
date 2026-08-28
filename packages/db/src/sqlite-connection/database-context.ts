import type { Outcome } from '@easter-workflow-builder/core';
import type { WorkflowRepository } from '../workflow-graph/workflow-repository.ts';
import type { WorkflowRunRepository } from '../workflow-run/workflow-run-repository.ts';
import type { StepRunRepository } from '../step-run/step-run-repository.ts';
import type { AppSettingRepository } from '../app-setting/app-setting-repository.ts';
import type { ProviderConcurrencyRepository } from '../provider-concurrency/provider-concurrency-repository.ts';

/**
 * Az adatbázis kapcsolat felülete. A `workflows` mező a `WorkflowRepository`-t
 * (T-003-12), a `runs` mező a `WorkflowRunRepository`-t (T-003-16), a
 * `stepRuns` mező a `StepRunRepository`-t adja (T-003-18), a `settings` mező
 * az `AppSettingRepository`-t, a `concurrencyLimits` mező a
 * `ProviderConcurrencyRepository`-t adja (T-003-23); a többi repository mező
 * a következő témák elkészültével bővül ide (`run-event`, ...), a SPEC-003
 * 9.1 szekció `DatabaseContext` alakja szerint.
 */
export interface DatabaseContext {
  readonly workflows: WorkflowRepository;
  readonly runs: WorkflowRunRepository;
  readonly stepRuns: StepRunRepository;
  readonly settings: AppSettingRepository;
  readonly concurrencyLimits: ProviderConcurrencyRepository;
  transaction<TValue>(work: () => Outcome<TValue>): Outcome<TValue>;
  close(): void;
}
