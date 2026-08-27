import type { Outcome } from '@easter-workflow-builder/core';
import type { WorkflowRepository } from '../workflow-graph/workflow-repository.ts';

/**
 * Az adatbázis kapcsolat felülete. A `workflows` mező a `WorkflowRepository`-t
 * adja (T-003-12); a többi repository mező a következő témák elkészültével
 * bővül ide (`graph-snapshot`, `workflow-run`, ...), a SPEC-003 9.1 szekció
 * `DatabaseContext` alakja szerint.
 */
export interface DatabaseContext {
  readonly workflows: WorkflowRepository;
  transaction<TValue>(work: () => Outcome<TValue>): Outcome<TValue>;
  close(): void;
}
