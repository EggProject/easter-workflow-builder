import type { CreateStepRunInput, StepRunRecord } from '@easter-workflow-builder/db';
import type { Outcome } from '@easter-workflow-builder/core';
import { emitEngineEvent } from './emit-engine-event.ts';
import type { NodeExecutorPorts } from './node-executor-ports.ts';

/**
 * A `beginStepRun` sikeres eredménye: a `running` állapotba vitt sor, és az
 * indulás időbélyege (`clock.nowMs()`, közvetlenül a `markStepRunning`
 * sikere után rögzítve). A hívó ezt adja tovább a záró
 * `finishStepRunSucceeded`/`finishStepRunFailed` hívásnak, hogy a
 * `step_finished` esemény `durationMs` mezője kiszámolható legyen a `clock`
 * porton keresztül (SPEC-004 14.2 determinizmus tábla: a motorban nincs
 * `Date.now()`).
 */
export interface BeganStepRun {
  readonly stepRun: StepRunRecord;
  readonly startedAtMs: number;
}

/**
 * Minden node végrehajtó közös nyitó menete (SPEC-004 5. szekció "Közös
 * szabályok minden végrehajtóra"): `createStepRun`, majd `markStepRunning`,
 * majd egy `step_started` motor esemény. A bemenet a `db` csomag
 * `CreateStepRunInput` típusa változtatás nélkül, hogy ez a függvény ne
 * duplikálja a mezőit - a hívó (egy `execute-*` függvény) állítja össze,
 * node típusonként eltérő `nodeType` és (a `T-005-21` óta) `modelId`/
 * `sessionMode`/`structuredOutputStrategy`/`subWorkflowRunId` mezővel.
 *
 * A három belső lépés bármelyike hibázhat (`Outcome` hibaág): a
 * `createStepRun` idegen kulcs sértésen (pl. nem létező `runId`), a
 * `markStepRunning` állapotgép sértésen (a frissen létrehozott sor mindig
 * `pending`, tehát ez a gyakorlatban csak versenyhelyzetben fordulhat elő -
 * lásd `begin-step-run.spec.ts`), az esemény írás pedig idegen kulcs
 * sértésen vagy lezárt adatbázison. Mindhárom ágnak van előidéző tesztesete.
 */
export function beginStepRun(input: CreateStepRunInput, ports: NodeExecutorPorts): Outcome<BeganStepRun> {
  const created = ports.database.stepRuns.createStepRun(input);
  if (created.kind === 'error') {
    return created;
  }

  const running = ports.database.stepRuns.markStepRunning(created.value.id);
  if (running.kind === 'error') {
    return running;
  }

  const startedAtMs = ports.clock.nowMs();

  const emitted = emitEngineEvent(
    {
      kind: 'step_started',
      runId: input.runId,
      stepRunId: running.value.id,
      payload: {
        nodeId: input.nodeId,
        nodeType: input.nodeType,
        providerId: input.providerId,
        attempt: running.value.attempt,
        iteration: running.value.iteration,
      },
    },
    ports,
  );
  if (emitted.kind === 'error') {
    return emitted;
  }

  return { kind: 'ok', value: { stepRun: running.value, startedAtMs } };
}
