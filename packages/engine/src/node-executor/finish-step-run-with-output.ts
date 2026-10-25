import type { StepRunRecord } from '@easter-workflow-builder/db';
import type { Outcome } from '@easter-workflow-builder/core';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';
import { finishStepRunFailed } from './finish-step-run-failed.ts';
import { finishStepRunSucceeded, type FinishStepRunSucceededInput } from './finish-step-run-succeeded.ts';
import { isStorableOutput } from './is-storable-output.ts';
import { MAX_STORED_OUTPUT_LENGTH } from './max-stored-output-length.ts';
import type { NodeExecutorPorts } from './node-executor-ports.ts';

/**
 * A `nodeId` csak a hibaüzenethez kell: a csomópontot nevezi meg, a kimenetet
 * nem idézi.
 */
export interface FinishStepRunWithOutputInput extends FinishStepRunSucceededInput {
  readonly nodeId: string;
}

/**
 * A `failed` ág a `NodeExecutionOutcome` `failed` ágának alakja, tehát a hívó
 * változtatás nélkül adhatja tovább; a `succeeded` ágból a hívó építi a saját
 * kimenetét (a `join` `merge` előtte még `join_resolved` eseményt ír).
 */
export type FinishedStepRunWithOutput =
  | { readonly kind: 'succeeded'; readonly stepRun: StepRunRecord }
  | {
      readonly kind: 'failed';
      readonly stepRun: StepRunRecord;
      readonly errorKind: 'step_output_not_storable';
      readonly errorMessage: string;
    };

/**
 * A kimenetet tároló lépések közös záró menete (SPEC-010 O-21, user döntés
 * 2026-10-25): a `MAX_STORED_OUTPUT_LENGTH` korlát a tárolás ELŐTT fut, és a
 * nem tárolható kimenet a lépést `step_output_not_storable` osztállyal zárja, a
 * tokenekkel és a kör számmal együtt, ha vannak. A `null` kimenetű lépések
 * (`branch`, `loop`, `error_handler`) és a saját előzetes ellenőrzéssel záró
 * `fan_out` (`expression_evaluation_failed`) a `finishStepRunSucceeded`
 * hívást közvetlenül használják; az egyetlen pontot az
 * `engine-port/config-invariants.spec.ts` 7. invariánsa őrzi.
 */
export function finishStepRunWithOutput(
  input: FinishStepRunWithOutputInput,
  ports: NodeExecutorPorts,
): Outcome<FinishedStepRunWithOutput> {
  const { nodeId, ...succeededInput } = input;
  if (isStorableOutput(input.output)) {
    const succeeded = finishStepRunSucceeded(succeededInput, ports);
    if (succeeded.kind === 'error') {
      return succeeded;
    }
    return { kind: 'ok', value: { kind: 'succeeded', stepRun: succeeded.value } };
  }

  const errorKind = 'step_output_not_storable';
  const errorMessage = formatEngineErrorMessage(
    errorKind,
    `A(z) "${nodeId}" node kimenete túl nagy a tároláshoz (legfeljebb ${String(MAX_STORED_OUTPUT_LENGTH)} karakter)`,
  );
  const failed = finishStepRunFailed(
    {
      runId: input.runId,
      stepRunId: input.stepRunId,
      startedAtMs: input.startedAtMs,
      errorKind,
      errorMessage,
      ...(input.tokens !== undefined && { tokens: input.tokens }),
      ...(input.resultSubtype !== undefined && { resultSubtype: input.resultSubtype }),
      ...(input.numTurns !== undefined && { numTurns: input.numTurns }),
    },
    ports,
  );
  if (failed.kind === 'error') {
    return failed;
  }
  return { kind: 'ok', value: { kind: 'failed', stepRun: failed.value, errorKind, errorMessage } };
}
