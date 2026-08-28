import type { StepRunRecord, StepRunTokenUsage } from '@easter-workflow-builder/db';
import type { Outcome } from '@easter-workflow-builder/core';
import type { EngineErrorKind } from '../engine-error/engine-error-kind.ts';
import { emitEngineEvent } from './emit-engine-event.ts';
import type { NodeExecutorPorts } from './node-executor-ports.ts';

/**
 * A `resultSubtype` és a `numTurns` a `runAgentStep` (`agent-step` téma)
 * `AgentStepExecution` értékéből jön: a lépés hibás `result` `subtype`-tal is
 * elhasznált tokent és kört (SPEC-004 5.2 8. pont, `agent-step-execution.ts`
 * doksija: "A `resultSubtype` ... a hibás ág üzenetében is szerepel"), ezért
 * mindkét mező a token összesítéssel azonos tranzakcióban íródhat a hibás
 * záráskor is.
 */
export interface FinishStepRunFailedInput {
  readonly runId: string;
  readonly stepRunId: string;
  readonly startedAtMs: number;
  readonly errorKind: EngineErrorKind;
  readonly errorMessage: string;
  readonly tokens?: StepRunTokenUsage;
  readonly resultSubtype?: string;
  readonly numTurns?: number;
}

/**
 * Minden node végrehajtó közös záró menete hibás esetben (SPEC-004 5.
 * szekció): `markStepFailed`, majd egy `step_finished` motor esemény,
 * ugyanazzal a `durationMs` számítással, mint a `finishStepRunSucceeded`-ben.
 * Az `errorMessage`-t a hívó a `formatEngineErrorMessage`-dzsel képezi (F-24
 * konvenció): ez a függvény nem formáz, csak továbbadja.
 */
export function finishStepRunFailed(input: FinishStepRunFailedInput, ports: NodeExecutorPorts): Outcome<StepRunRecord> {
  const failed = ports.database.stepRuns.markStepFailed(input.stepRunId, input.errorKind, input.errorMessage, {
    ...(input.tokens !== undefined && { tokens: input.tokens }),
    ...(input.resultSubtype !== undefined && { resultSubtype: input.resultSubtype }),
    ...(input.numTurns !== undefined && { numTurns: input.numTurns }),
  });
  if (failed.kind === 'error') {
    return failed;
  }

  const durationMs = ports.clock.nowMs() - input.startedAtMs;

  /* eslint-disable-next-line unicorn/no-null -- a `StepFinishedPayload.tokens` mezője `StepRunTokenUsage | null`, ennek az öt node típusnak egyikéhez sincs token adata (SPEC-004 13. szekció) */
  const tokens = input.tokens ?? null;

  const emitted = emitEngineEvent(
    {
      kind: 'step_finished',
      runId: input.runId,
      stepRunId: input.stepRunId,
      payload: { status: failed.value.status, errorKind: input.errorKind, durationMs, tokens },
    },
    ports,
  );
  if (emitted.kind === 'error') {
    return emitted;
  }

  return { kind: 'ok', value: failed.value };
}
