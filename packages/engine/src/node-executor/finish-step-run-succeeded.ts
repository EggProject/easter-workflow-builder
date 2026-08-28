import type { StepRunRecord, StepRunTokenUsage } from '@easter-workflow-builder/db';
import type { Outcome } from '@easter-workflow-builder/core';
import { emitEngineEvent } from './emit-engine-event.ts';
import type { NodeExecutorPorts } from './node-executor-ports.ts';

/**
 * Az `output` kötelező (nem `?:`), hogy a hívó minden esetben explicit
 * döntsön a lépés kimenetéről, akkor is, ha az `null` (SPEC-004 5. szekció
 * táblázata csak a `start` és a `join` `merge` módjára nevez meg konkrét
 * kimenetet; a `branch` és a `loop` node kimenete erre a témára szűkítve
 * `null`, lásd az egyes `execute-*.ts` fájlok dokumentációját). A
 * `structured_output_strategy` mind az öt, ebben a lépésben megvalósított
 * node típusra `null`, tehát a `markStepSucceeded` `missing_structured_output`
 * ellenőrzése sosem lép életbe erről a hívási útról (F-6, SPEC-003 7.2 - az
 * ellenőrzés az `agent_step`/`join` `ai_synthesis` módra vár, T-005-21).
 */
export interface FinishStepRunSucceededInput {
  readonly runId: string;
  readonly stepRunId: string;
  readonly startedAtMs: number;
  readonly output: unknown;
  readonly tokens?: StepRunTokenUsage;
}

/**
 * Minden node végrehajtó közös záró menete sikeres esetben (SPEC-004 5.
 * szekció): `markStepSucceeded`, majd egy `step_finished` motor esemény, a
 * `durationMs`-t a `clock` portból számolva a `beginStepRun` által rögzített
 * `startedAtMs`-hez képest.
 */
export function finishStepRunSucceeded(
  input: FinishStepRunSucceededInput,
  ports: NodeExecutorPorts,
): Outcome<StepRunRecord> {
  const succeeded = ports.database.stepRuns.markStepSucceeded(input.stepRunId, {
    output: input.output,
    ...(input.tokens !== undefined && { tokens: input.tokens }),
  });
  if (succeeded.kind === 'error') {
    return succeeded;
  }

  const durationMs = ports.clock.nowMs() - input.startedAtMs;

  /* eslint-disable unicorn/no-null -- a `StepFinishedPayload` `errorKind: EngineErrorKind | null` és `tokens: StepRunTokenUsage | null` mezője a tárolt alak valódi kezdő/hiány értéke (SPEC-004 13. szekció), nem helyőrző */
  const emitted = emitEngineEvent(
    {
      kind: 'step_finished',
      runId: input.runId,
      stepRunId: input.stepRunId,
      payload: {
        status: succeeded.value.status,
        errorKind: null,
        durationMs,
        tokens: input.tokens ?? null,
      },
    },
    ports,
  );
  /* eslint-enable unicorn/no-null */
  if (emitted.kind === 'error') {
    return emitted;
  }

  return { kind: 'ok', value: succeeded.value };
}
