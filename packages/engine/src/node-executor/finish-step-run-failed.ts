import type { StepRunRecord, StepRunTokenUsage } from '@easter-workflow-builder/db';
import type { Outcome } from '@easter-workflow-builder/core';
import type { EngineErrorKind } from '../engine-error/engine-error-kind.ts';
import { emitEngineEvent } from './emit-engine-event.ts';
import type { NodeExecutorPorts } from './node-executor-ports.ts';

export interface FinishStepRunFailedInput {
  readonly runId: string;
  readonly stepRunId: string;
  readonly startedAtMs: number;
  readonly errorKind: EngineErrorKind;
  readonly errorMessage: string;
  readonly tokens?: StepRunTokenUsage;
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
