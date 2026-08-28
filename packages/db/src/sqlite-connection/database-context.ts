import type { Outcome } from '@easter-workflow-builder/core';
import type { WorkflowRepository } from '../workflow-graph/workflow-repository.ts';
import type { WorkflowRunRepository } from '../workflow-run/workflow-run-repository.ts';

/**
 * Az adatbázis kapcsolat felülete. A `workflows` mező a `WorkflowRepository`-t
 * (T-003-12), a `runs` mező a `WorkflowRunRepository`-t adja (T-003-16); a
 * többi repository mező a következő témák elkészültével bővül ide
 * (`step-run`, `run-event`, ...), a SPEC-003 9.1 szekció `DatabaseContext`
 * alakja szerint.
 */
export interface DatabaseContext {
  readonly workflows: WorkflowRepository;
  readonly runs: WorkflowRunRepository;
  transaction<TValue>(work: () => Outcome<TValue>): Outcome<TValue>;
  close(): void;
}
