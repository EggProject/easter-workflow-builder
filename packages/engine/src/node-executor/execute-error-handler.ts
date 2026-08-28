import type { ErrorHandlerNodeConfig } from '@easter-workflow-builder/db';
import type { Outcome } from '@easter-workflow-builder/core';
import type { EngineErrorKind } from '../engine-error/engine-error-kind.ts';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';
import type { RetryDecision } from '../error-policy/retry-decision.ts';
import { resolveRetryDecision } from '../error-policy/resolve-retry-decision.ts';
import { beginStepRun } from './begin-step-run.ts';
import { finishStepRunFailed } from './finish-step-run-failed.ts';
import { finishStepRunSucceeded } from './finish-step-run-succeeded.ts';
import type { NodeExecutionInstance } from './node-executor-instance.ts';
import type { NodeExecutionOutcome } from './node-executor-outcome.ts';
import type { NodeExecutorPorts } from './node-executor-ports.ts';

/**
 * Az `error_handler` node bemenete (SPEC-004 5. szekció 8. sora, 8.2
 * szekció). **A node nem foglal párhuzamossági helyet** (7.2 táblázat: "csak
 * vezérlés; a **retry** viszont a megismételt lépés fajtája szerint foglal"),
 * ezért - a `branch`/`loop`/`human_approval`/`sub_workflow` végrehajtóhoz
 * hasonlóan - csak a hat `NodeExecutorPorts` portot igényli.
 *
 * **A végrehajtó nem deríti ki, melyik lépés hibázott.** Azt a hívó (a
 * `run-supervisor`, T-005-25) tudja, mert ő futtatta a hibára futó node
 * példányt, és ő vezette a vezérlést az `on_error` élen ide (8.1 1. pont).
 * Ezért a hiba három adata bemenet:
 *
 * - `failedErrorKind`: a hibát adó lépés `error_kind` értéke. A
 *   `handledErrorKinds` szűrés ezt méri (8.2 1. pont).
 * - `failedAttempt`: az az `attempt` sorszám, amin a lépés elbukott. Ebből
 *   jön a kísérletszám ellenőrzés és a `backoffMs[attempt - 1]` index (8.2 2.
 *   és 3. pont).
 *
 * **A megismételt lépés `step_run` sorát ez a végrehajtó NEM hozza létre**
 * (T-005-25 lezárta a T-005-24 óta nyitva állt szerkezeti kérdést): a
 * `retry_scheduled` kimenet csak a `nextAttempt` sorszámot adja vissza, a
 * sort a `run-supervisor` írja, amikor a megismételt példányt a szokásos
 * `executeNode` úton futtatja. Enélkül két sor keletkezne ugyanarra a
 * kísérletre: egy itt, egy a `beginStepRun` közös nyitó menetében. Lásd a
 * `node-executor-outcome.ts` `retry_scheduled` ágának doksiját.
 */
export interface ExecuteErrorHandlerInput {
  readonly instance: NodeExecutionInstance;
  readonly config: ErrorHandlerNodeConfig;
  readonly failedErrorKind: EngineErrorKind;
  readonly failedAttempt: number;
}

interface HandlerFailure {
  readonly errorKind: EngineErrorKind;
  readonly errorMessage: string;
}

/**
 * A három nem-újrapróbálkozó döntés leképezése hibaosztályra és üzenetre
 * (F-24 konvenció: az osztály neve zárójelben az üzenet végén). A `retry` ág
 * ide nem juthat el, ezért a paraméter típusa is kizárja - így a `switch`
 * kimerítő marad, és nem keletkezik sosem futó ág.
 */
function describeHandlerFailure(
  decision: Exclude<RetryDecision, { readonly kind: 'retry' }>,
  input: ExecuteErrorHandlerInput,
): HandlerFailure {
  const nodeId = input.instance.instance.nodeId;
  switch (decision.kind) {
    case 'unhandled_error_kind': {
      return {
        errorKind: 'unhandled_error_kind',
        errorMessage: formatEngineErrorMessage(
          'unhandled_error_kind',
          `A(z) ${nodeId} error_handler node handledErrorKinds listája nem tartalmazza a(z) ${input.failedErrorKind} hibaosztályt`,
        ),
      };
    }
    case 'attempts_exhausted': {
      return {
        errorKind: 'retry_attempts_exhausted',
        errorMessage: formatEngineErrorMessage(
          'retry_attempts_exhausted',
          `A(z) ${nodeId} error_handler node minden kísérlete elfogyott (maxAttempts: ${String(input.config.maxAttempts)})`,
        ),
      };
    }
    case 'missing_backoff': {
      return {
        errorKind: 'insufficient_backoff_list',
        errorMessage: formatEngineErrorMessage(
          'insufficient_backoff_list',
          `A(z) ${nodeId} error_handler node backoffMs listájában nincs érték a(z) ${String(input.failedAttempt)}. kísérlethez`,
        ),
      };
    }
  }
}

/**
 * Az `error_handler` node végrehajtója (SPEC-004 5. szekció 8. sora, 8.2
 * szekció öt pontja). A menet:
 *
 * 1. `createStepRun` + `markStepRunning` + `step_started` a kezelő **saját**
 *    sorára (`beginStepRun`, 5. szekció "Közös szabályok").
 * 2 ... 3. A döntés a `error-policy` téma tiszta függvényéből
 *    (`resolveRetryDecision`): `handledErrorKinds` szűrés, majd a
 *    kísérletszám, majd a `backoffMs` elem kiolvasása.
 * 4. **Várakozás a `clock` porton**, `backoffMs[attempt - 1]` ideig, majd a
 *    `nextAttempt` sorszám visszaadása; az új kísérlet `step_run` sorát a
 *    hívó írja, amikor a megismételt példányt futtatja (lásd fent). Az
 *    **eredeti sor `failed` állapotban marad**, ezt a végrehajtó nem írja át
 *    (8.1 zárómondata). A kezelő saját lépése `succeeded` állapotban zár,
 *    mert a feladatát elvégezte: ütemezett egy újabb kísérletet.
 * 5. A vezérlés a **megismételt node** saját kimenő élein megy tovább, nem az
 *    `error_handler` élein; a kezelő kimenő élei kizárólag az `exhausted`
 *    ágat szolgálják. Ezt a `NodeExecutionOutcome` két új ága
 *    (`retry_scheduled`, `retry_exhausted`) mondja ki a hívónak.
 *
 * **A backoff várakozás `AbortSignal`-ja ma egy soha meg nem szakított
 * vezérlő jele.** A `ClockPort.sleep` szerződése kötelezően kér jelet, a
 * futás megszakítása viszont a `run-interrupt` téma dolga (9. szekció,
 * T-005-26), ami ebben a lépésben még nem létezik. A jelet ezért a végrehajtó
 * hozza létre; amikor a megszakítás megérkezik, a jel forrása a futás
 * megszakítási vezérlője lesz. Ez megnevezett hiány, nem elfogadott
 * végállapot.
 */
export async function executeErrorHandler(
  input: ExecuteErrorHandlerInput,
  ports: NodeExecutorPorts,
): Promise<Outcome<NodeExecutionOutcome>> {
  const { instance, config } = input;

  /* eslint-disable unicorn/no-null -- az `error_handler` node nem agent lépés, nincs modellje, session módja, strukturált kimenet stratégiája vagy al-workflow futása (SPEC-003 9.2) */
  const began = beginStepRun(
    {
      runId: instance.runId,
      nodeId: instance.instance.nodeId,
      nodeType: 'error_handler',
      parentStepRunId: instance.parentStepRunId,
      iteration: instance.iteration,
      attempt: instance.attempt,
      providerId: instance.providerId,
      modelId: null,
      sessionMode: null,
      structuredOutputStrategy: null,
      subWorkflowRunId: null,
    },
    ports,
  );
  /* eslint-enable unicorn/no-null */
  if (began.kind === 'error') {
    return began;
  }
  const stepRunId = began.value.stepRun.id;
  const { runId } = instance;
  const { startedAtMs } = began.value;

  const decision = resolveRetryDecision({
    config,
    failedErrorKind: input.failedErrorKind,
    failedAttempt: input.failedAttempt,
  });

  if (decision.kind === 'retry') {
    await ports.clock.sleep(decision.backoffMs, new AbortController().signal);

    /* eslint-disable-next-line unicorn/no-null -- az `error_handler` node kimenete szándékosan `null`, ugyanazzal az indokkal, mint a `branch` és a `loop` node-nál: vezérlést hordoz, adatot nem */
    const finished = finishStepRunSucceeded({ runId, stepRunId, startedAtMs, output: null }, ports);
    if (finished.kind === 'error') {
      return finished;
    }

    return {
      kind: 'ok',
      value: { kind: 'retry_scheduled', stepRun: finished.value, nextAttempt: decision.nextAttempt },
    };
  }

  const failure = describeHandlerFailure(decision, input);
  const failed = finishStepRunFailed(
    { runId, stepRunId, startedAtMs, errorKind: failure.errorKind, errorMessage: failure.errorMessage },
    ports,
  );
  if (failed.kind === 'error') {
    return failed;
  }

  if (decision.kind === 'attempts_exhausted') {
    return {
      kind: 'ok',
      value: {
        kind: 'retry_exhausted',
        stepRun: failed.value,
        errorKind: 'retry_attempts_exhausted',
        errorMessage: failure.errorMessage,
      },
    };
  }

  return {
    kind: 'ok',
    value: {
      kind: 'failed',
      stepRun: failed.value,
      errorKind: failure.errorKind,
      errorMessage: failure.errorMessage,
    },
  };
}
