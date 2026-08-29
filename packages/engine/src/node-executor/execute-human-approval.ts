import type { ApprovalDecision } from '@easter-workflow-builder/db';
import type { Outcome } from '@easter-workflow-builder/core';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';
import type { RunContext } from '../run-context/run-context.ts';
import type { ExecutableNodeConfig } from '../run-validation/executable-node-config.ts';
import type { ApprovalWaitRegistry } from './approval-wait-registry.ts';
import { beginStepRun } from './begin-step-run.ts';
import { emitEngineEvent } from './emit-engine-event.ts';
import { finishStepRunFailed } from './finish-step-run-failed.ts';
import type { NodeExecutionInstance } from './node-executor-instance.ts';
import type { NodeExecutionOutcome } from './node-executor-outcome.ts';
import type { NodeExecutionResult } from './node-executor-result.ts';
import type { NodeExecutorPorts } from './node-executor-ports.ts';

type HumanApprovalNodeConfig = Extract<ExecutableNodeConfig, { readonly type: 'human_approval' }>;

/**
 * A `human_approval` node bemenete (SPEC-004 5. szekció 7. sora, 5.8
 * szekció). **A node NEM foglal helyet a `concurrency-gate`-től** (7.2
 * táblázat: a "vár egy külső, ember hozta döntésre" jellegű lépés holtpontot
 * okozna, ha egy szabályozott providernél a helyet a döntésig fogva tartaná),
 * ezért ez a bemenet - a `branch`/`fan_out`/`loop` típusokhoz hasonlóan -
 * csak a hat `NodeExecutorPorts` portot igényli, `ConcurrencyGate`-et nem kap.
 *
 * **Nem kapja meg, van-e kimenő `rejected` `branch_key` él.** A SPEC-004 5.8
 * utolsó pontja szerint ez a döntés a hívóé (jövőbeli `run-supervisor`,
 * T-005-25): a végrehajtó a döntést (`ApprovalDecision`) egyszerűen
 * visszaadja a `NodeExecutionOutcome` `approval_decided` ágán
 * (`node-executor-outcome.ts`), az élválasztást és a hibapolitika
 * alkalmazását a hívóra bízva.
 */
export interface ExecuteHumanApprovalInput {
  readonly instance: NodeExecutionInstance;
  readonly config: HumanApprovalNodeConfig;
  readonly runContext: RunContext;
}

/**
 * Az időkorlát verseny egyetlen belső eredménye: döntés érkezett, kívülről
 * megszakították a várakozást, vagy lejárt az időkorlát. A `timed_out` ág a
 * lejárt `timeoutMs` értéket is hordozza (nem `config.timeoutMs`-t, ami
 * `number | null`), hogy a hívó (`executeHumanApproval`) a hibaüzenetben
 * `null`-ellenőrzés nélkül, típusbiztosan hivatkozhasson rá - ez az érték csak
 * a `raceApprovalDecision` `timeoutMs !== null` ágán belül keletkezik, ahol a
 * szűkítés már megtörtént.
 */
type ApprovalWaitResult =
  | { readonly kind: 'decided'; readonly decision: ApprovalDecision }
  | { readonly kind: 'interrupted' }
  | { readonly kind: 'timed_out'; readonly timeoutMs: number };

/**
 * A `Promise.race` a `waitForDecision` és - ha van időkorlát - a `clock.sleep`
 * között (SPEC-004 5.8 2. pont, PLAN-005 T-005-22 "Az időkorlát verseny").
 *
 * **`timeoutMs === null`: nincs `sleep` hívás, korlátlan várakozás** (SPEC-004
 * 5.8 1. pont, 24. elfogadási kritérium: "a motorban nincs szállított
 * időkorlát szám"). Ilyenkor a függvény közvetlenül a döntésre váró
 * `Promise`-t adja vissza, `AbortController` és `Promise.race` nélkül. Ez az
 * ág a T-005-31 óta sem vár ÖRÖKRE: a `waitForDecision` `interrupted`
 * jelzéssel is feloldódhat, amit a megszakítás vagy a szabályos leállás
 * (`ApprovalWaitRegistry.cancelWaitingForRunIds`) küld.
 *
 * **`timeoutMs !== null`: a vesztes ágat meg kell szakítani.** Ha a döntés
 * vagy a megszakítás nyer, a `sleep`-et a `controller.abort()` állítja le; a
 * `sleep` esetleges emiatti elutasítását a belső `try/catch` szándékosan
 * nyeli el, mert ez az ág csak akkor fut le, ha MI hívtuk az `abort()`-ot,
 * tehát az értéke úgysem kerül felhasználásra - ez a minta függetlenít attól,
 * hogy egy jövőbeli valós `ClockPort.sleep` megszakításkor elutasít-e vagy
 * egyszerűen feloldódik, mindkét esetben helyesen viselkedik, unhandled
 * rejection nélkül. Ha a `sleep` nyer, a `registry.cancelWait(...)` törli a
 * döntésre váró bejegyzést, hogy az ne maradjon örökre a regiszterben egy
 * sosem beérkező (vagy már elkésett) döntésre várva.
 */
async function raceApprovalDecision(
  runId: string,
  stepRunId: string,
  timeoutMs: number | null,
  ports: NodeExecutorPorts,
  registry: ApprovalWaitRegistry,
): Promise<ApprovalWaitResult> {
  const signalPromise: Promise<ApprovalWaitResult> = (async (): Promise<ApprovalWaitResult> => {
    const signal = await registry.waitForDecision(runId, stepRunId);
    return signal.kind === 'decided' ? { kind: 'decided', decision: signal.decision } : { kind: 'interrupted' };
  })();

  if (timeoutMs === null) {
    return signalPromise;
  }

  const controller = new AbortController();
  const timeoutPromise: Promise<ApprovalWaitResult> = (async () => {
    try {
      await ports.clock.sleep(timeoutMs, controller.signal);
    } catch {
      // Lásd a függvény doksiját: ez az ág csak a lenti `controller.abort()`
      // hívás következménye lehet, az értéke ilyenkor eldobódik.
    }
    return { kind: 'timed_out' as const, timeoutMs };
  })();

  const result = await Promise.race([signalPromise, timeoutPromise]);
  if (result.kind === 'timed_out') {
    registry.cancelWait(stepRunId);
  } else {
    controller.abort();
  }
  return result;
}

function failApproval(
  runId: string,
  stepRunId: string,
  startedAtMs: number,
  errorKind: 'template_render_failed' | 'approval_timed_out',
  errorMessage: string,
  ports: NodeExecutorPorts,
): Outcome<NodeExecutionOutcome> {
  const failed = finishStepRunFailed({ runId, stepRunId, startedAtMs, errorKind, errorMessage }, ports);
  if (failed.kind === 'error') {
    return failed;
  }
  return { kind: 'ok', value: { kind: 'failed', stepRun: failed.value, errorKind, errorMessage } };
}

/**
 * A `human_approval` node végrehajtója (SPEC-004 5. szekció 7. sora, 5.8
 * szekció, PLAN-005 T-005-22):
 *
 * 1. `beginStepRun` (`createStepRun` + `markStepRunning` + `step_started`,
 *    hely kérése nélkül).
 * 2. `bodyTemplate` renderelése a `templateRenderer` porton -
 *    `template_render_failed` hiba esetén azonnali zárás.
 * 3. `database.approvals.requestApproval(...)` - ez a hívás MAGA viszi a
 *    lépést `running -> waiting_approval` állapotba, egy tranzakcióban a
 *    `human_approval` sor beszúrásával (`human-approval-repository.ts`
 *    `requestApproval` doksija), ezért ez a végrehajtó nem hívja külön a
 *    `markStepWaitingApproval`-t. A `payload` mezőbe a teljes `runContext`
 *    kerül: ez már készen áll (nincs plusz számítás), és egy jövőbeli
 *    jóváhagyó felület ugyanazt a kontextust láthatja, amivel a
 *    `bodyTemplate` is renderelődött (pl. a `item`/`itemIndex` értéket, ha a
 *    jóváhagyás egy `fan_out` ágban áll) - séma bővítés nélkül, mert a
 *    `payload` oszlop `unknown` (SPEC-003 4.12).
 * 4. `approval_requested` esemény, a `requestedAtMs`-t és a `timeoutAtMs`-t a
 *    `clock` portból számítva (nem a repository saját, `new Date()` alapú
 *    időbélyegéből, ugyanaz a determinizmus elv, mint minden más eseménynél).
 * 5. Várakozás a `raceApprovalDecision` szerint.
 * 6. **Megszakításkor** (T-005-31, SPEC-004 9. szekció, 10.2 szekció): a
 *    végrehajtó AZONNAL visszatér az `interrupted` kimenettel, `step_run`
 *    állapotváltás és esemény írás NÉLKÜL. A lépés sorát a megszakítást kérő
 *    fél zárja le, a futás sorával egyetlen tranzakcióban - és a két hívó két
 *    KÜLÖNBÖZŐ záró állapotot ír (`cancelled` a felhasználói megszakításnál,
 *    `interrupted` a szabályos leállásnál), amit ez a végrehajtó nem tudna
 *    eldönteni (`approval-wait-signal.ts`).
 * 7. **Lejáratkor**: `finishStepRunFailed` `approval_timed_out` osztállyal - a
 *    `human_approval.decision` oszlop NULL marad, mert a `db.approvals
 *    .decideApproval(...)` sosem hívódott (`human-approval-repository.ts`
 *    `toPendingApprovalRecord` doksija ugyanezt az invariánst őrzi a lekérdező
 *    oldalon).
 * 8. **Döntés érkezésekor**: a `db.approvals.decideApproval(...)` (KÜLSŐ hívó,
 *    a `createEngine` `decideApproval` motor művelete, T-005-28) már elvégezte
 *    a `step_run` állapotváltást, mielőtt a regiszteren át értesítést küldött
 *    volna - ezért ez a végrehajtó `getStepRun`-nal olvassa vissza az
 *    időközben lezárt sort, egy `step_finished` eseményt ír (lásd lent), majd
 *    `approval_decided` eseményt (`waitedMs = decidedAtMs - requestedAtMs`),
 *    és az `approval_decided` `NodeExecutionOutcome` ágán adja vissza a
 *    döntést.
 *
 * **A `step_finished` esemény a döntés-érkezés útvonalon (T-005-28 óta
 * lezárva).** A SPEC-004 5. szekció "Közös szabályok" pontja minden lépés
 * zárásához `step_finished` eseményt ír elő, de ezen az úton a tényleges
 * állapotváltás (`markStepSucceeded`/`markStepRejected`) a `db.approvals
 * .decideApproval(...)` belseje, nem ez a végrehajtó, tehát a szokásos
 * `finishStepRunSucceeded`/`finishStepRunFailed` segéd nem hívható újra (a
 * sor már terminális, egy második állapotváltás `illegal_status_transition`
 * hibát adna). A végrehajtó ezért **közvetlenül** `emitEngineEvent`-tel írja
 * az eseményt, a már visszaolvasott `stepRunAfterDecision.value.status`
 * mezővel; az `errorKind` és a `tokens` mindig `null`, mert sem a
 * `markStepSucceeded`, sem a `markStepRejected` hívás nem ír `error_kind`
 * vagy token oszlopot (`human-approval-repository.ts`). A `durationMs` a
 * `beginStepRun` által rögzített `startedAtMs`-hez képest, a `clock` portból,
 * ugyanazzal a számítással, mint a `finishStepRunSucceeded`/
 * `finishStepRunFailed` segédben.
 */
export async function executeHumanApproval(
  input: ExecuteHumanApprovalInput,
  ports: NodeExecutorPorts,
  registry: ApprovalWaitRegistry,
): Promise<Outcome<NodeExecutionResult>> {
  const { instance, config, runContext } = input;
  const nodeId = instance.instance.nodeId;
  const { runId } = instance;

  /* eslint-disable unicorn/no-null -- a `human_approval` node nem agent lépés, nincs modellje, session módja, strukturált kimenet stratégiája vagy al-workflow futása (SPEC-003 9.2) */
  const began = beginStepRun(
    {
      runId,
      nodeId,
      nodeType: 'human_approval',
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
  const { startedAtMs } = began.value;

  const rendered = ports.templateRenderer.render(config.bodyTemplate, runContext);
  if (rendered.kind === 'error') {
    const errorMessage = formatEngineErrorMessage(
      'template_render_failed',
      `A(z) "${nodeId}" human_approval node "${config.bodyTemplate}" szöveg sablonjának renderelése sikertelen: ${rendered.message}`,
    );
    return failApproval(runId, stepRunId, startedAtMs, 'template_render_failed', errorMessage, ports);
  }

  const requestedAtMs = ports.clock.nowMs();
  const requested = ports.database.approvals.requestApproval({
    runId,
    stepRunId,
    title: config.title,
    body: rendered.value,
    payload: runContext,
  });
  if (requested.kind === 'error') {
    return requested;
  }

  /* eslint-disable-next-line unicorn/no-null -- az `ApprovalRequestedPayload.timeoutAtMs` `null` értéke a korlátlan várakozás valódi jelentése (SPEC-004 5.8 1. pont), nem helyőrző */
  const timeoutAtMs = config.timeoutMs === null ? null : requestedAtMs + config.timeoutMs;
  const requestEmitted = emitEngineEvent(
    {
      kind: 'approval_requested',
      runId,
      stepRunId,
      payload: { approvalId: requested.value.id, requestedAtMs, timeoutAtMs },
    },
    ports,
  );
  if (requestEmitted.kind === 'error') {
    return requestEmitted;
  }

  const raced = await raceApprovalDecision(runId, stepRunId, config.timeoutMs, ports, registry);

  // A várakozást a megszakítás vagy a szabályos leállás zárta le: a végrehajtó
  // egyetlen állapotváltást és egyetlen eseményt sem ír, a lépés sorát a
  // megszakítást kérő fél zárja le a futás sorával EGYETLEN tranzakcióban
  // (`approval-wait-signal.ts` doksija).
  if (raced.kind === 'interrupted') {
    return { kind: 'ok', value: { kind: 'interrupted' } };
  }

  if (raced.kind === 'timed_out') {
    const errorMessage = formatEngineErrorMessage(
      'approval_timed_out',
      `A(z) "${nodeId}" human_approval node várakozása lejárt (${String(raced.timeoutMs)} ms) döntés nélkül`,
    );
    return failApproval(runId, stepRunId, startedAtMs, 'approval_timed_out', errorMessage, ports);
  }

  const stepRunAfterDecision = ports.database.stepRuns.getStepRun(stepRunId);
  if (stepRunAfterDecision.kind === 'error') {
    return stepRunAfterDecision;
  }

  const decidedAtMs = ports.clock.nowMs();

  /* eslint-disable unicorn/no-null -- a `StepFinishedPayload.errorKind`/`.tokens` mezője a döntés-érkezés útvonalon mindig a tárolt alak valódi hiány értéke: sem a `markStepSucceeded`, sem a `markStepRejected` hívás nem ír `error_kind` vagy token oszlopot (SPEC-004 5.8 utolsó pontja, `human-approval-repository.ts`) */
  const stepFinishedEmitted = emitEngineEvent(
    {
      kind: 'step_finished',
      runId,
      stepRunId,
      payload: {
        status: stepRunAfterDecision.value.status,
        errorKind: null,
        durationMs: decidedAtMs - startedAtMs,
        tokens: null,
      },
    },
    ports,
  );
  /* eslint-enable unicorn/no-null */
  if (stepFinishedEmitted.kind === 'error') {
    return stepFinishedEmitted;
  }

  const decidedEmitted = emitEngineEvent(
    {
      kind: 'approval_decided',
      runId,
      stepRunId,
      payload: { decision: raced.decision, decidedAtMs, waitedMs: decidedAtMs - requestedAtMs },
    },
    ports,
  );
  if (decidedEmitted.kind === 'error') {
    return decidedEmitted;
  }

  return {
    kind: 'ok',
    value: { kind: 'approval_decided', stepRun: stepRunAfterDecision.value, decision: raced.decision },
  };
}
