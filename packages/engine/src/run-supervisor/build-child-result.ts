import type { Outcome } from '@easter-workflow-builder/core';
import type { WorkflowRunRecord } from '@easter-workflow-builder/db';
import type { RunCompletion } from '../error-policy/run-completion.ts';
import type { ChildWorkflowRunResult } from '../node-executor/child-workflow-runner.ts';
import type { ExecutedStepInstance } from '../run-context/executed-step-instance.ts';
import type { ExecutableGraph } from '../run-graph/executable-graph.ts';
import { collectTerminalOutput } from './collect-terminal-output.ts';

/**
 * Egy lezárult gyerek futás eredménye a `sub_workflow` végrehajtónak
 * (SPEC-004 5.9 6. pont): a terminális `WorkflowRunRecord` és a futás kimenete.
 *
 * **Tiszta összefűző függvény**, ami a két `Outcome` bemenetét kapja készen.
 * Ugyanaz a megfontolás, mint a `collectRunInputs` esetén: éles futásban a
 * `getRun` a lezárult futásra sosem hibázik, tehát ha a függvény maga hívná,
 * az az ág sosem futna le. Bemenetként viszont mindkét hibaág előidézhető.
 */
export function buildChildResult(
  completion: Outcome<RunCompletion>,
  run: Outcome<WorkflowRunRecord>,
  graph: ExecutableGraph,
  executedInstances: readonly ExecutedStepInstance[],
): Outcome<ChildWorkflowRunResult> {
  if (completion.kind === 'error') {
    return completion;
  }
  if (run.kind === 'error') {
    return run;
  }
  return {
    kind: 'ok',
    value: { run: run.value, output: collectTerminalOutput(graph, executedInstances) },
  };
}
