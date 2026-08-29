import type { Outcome } from '@easter-workflow-builder/core';
import { isRecord } from '@easter-workflow-builder/typeguards';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';
import type { DatabaseContext } from '../engine-port/database-port.ts';
import type { RunSupervisor, StartedRun } from './run-supervisor.ts';

/**
 * A `restartRun` függősége. A `runSupervisor` szándékosan csak a `startRun`
 * metódust várja (`Pick`, nem a teljes `RunSupervisor`), ugyanaz az elv, mint
 * az `InterruptRunDependencies`-nél (`run-interrupt/interrupt-run.ts`): ez a
 * téma nem szakít meg futást és nem kérdez le aktív kézikönyvet, csak a
 * `startRun` menetét hívja ÚJRA. A `createEngine` (T-005-28) a saját, teljes
 * `RunSupervisor` példányát adja majd ide.
 */
export interface RestartRunDependencies {
  readonly database: DatabaseContext;
  readonly runSupervisor: Pick<RunSupervisor, 'startRun'>;
}

/**
 * A motor `restartRun` művelete (SPEC-004 3.1 `Engine` felület, 9. szekció
 * zárómondata, SPEC-003 27. kritérium, PLAN-005 T-005-27): "a workflow
 * AKTUÁLIS állapotáról készít pillanatképet, a `restarted_from_run_id`
 * mezőben rögzíti a származást, és felajánlja az eredeti futás bemenetének
 * átvételét."
 *
 * **Miért elég ÚJRAHASZNÁLNI a `RunSupervisor.startRun`-t, saját gráf-
 * olvasás nélkül.** A `startRun` (`create-run-supervisor.ts`
 * `startRunInternals`) a SPEC-004 4.8 menet 1. lépéseként MINDIG a workflow
 * JELENLEGI gráfját olvassa (`database.workflows.readGraph(request.workflowId)`),
 * sosem az eredeti futás régi pillanatképét. Ha tehát ez a függvény az
 * EREDETI futás `workflowId`-jével és `input`-jával hívja meg a `startRun`-t,
 * az eredmény AUTOMATIKUSAN a workflow aktuális állapotára épül - ezt nem
 * kell újra megvalósítani, csak a helyes bemenettel meghívni.
 *
 * **Az `input` alaki szűkítése (`isRecord`) NEM korrupt adatra védekezik.**
 * A `WorkflowRunRecord.input` típusa `unknown`, mert a `db` réteg
 * `StartRunInput.input` mezője is `unknown` (nem `Record`) - a `db` réteg
 * SOSEM kényszeríti ki a rekord alakot, csak a motor `StartRunRequest.input`
 * mezője (`Readonly<Record<string, unknown>>`). Ez a szűkítés tehát a KÉT
 * réteg típusgaranciája közötti valódi rést hidalja át, nem elméleti esetre
 * ír hibaágat: bármely, a motoron KÍVÜLI hívó (pl. egy jövőbeli adminisztrációs
 * eszköz) tárolhatott korábban nem rekord alakú bemenetet a `db` felületén
 * keresztül. `malformed_restart_source_input` hibaosztállyal utasítja el,
 * ÚJRAINDÍTÁS nélkül - a bemenetet nem "javítjuk ki" `{}`-re, mert az
 * csendben más adatot indítana el, mint amit a felhasználó kért (ugyanaz az
 * elv, mint a `no_resumable_session` hibaágnál, SPEC-004 6.3 szekció).
 *
 * **A "nem található" eredeti futás hibaágát a `db` már megadja, nem kell
 * új `EngineErrorKind`.** A `database.runs.getRun(runId)` `not_found`
 * hibaüzenete (a hibaosztály neve zárójelben, F-24 konvenció, csak a `db`
 * réteg saját szótárából) VÁLTOZATLANUL megy tovább az `Outcome` hibaágán -
 * ugyanaz a minta, mint az `interruptRun` cél futás beolvasásánál
 * (`run-interrupt/interrupt-run.ts` 1. pontja).
 *
 * **Nincs állapot ellenőrzés az eredeti futáson.** A SPEC-004 és a SPEC-003
 * egyike sem kér meg olyan szabályt, hogy csak terminális (vagy csak
 * `interrupted`/`cancelled`) futás legyen újraindítható - egy ilyen
 * korlátozás kitalált szabály lenne, ezért nincs bevezetve (`.claude/CLAUDE.md`
 * 2. szekció "Minimum kód").
 */
export function restartRun(runId: string, dependencies: RestartRunDependencies): Promise<Outcome<StartedRun>> {
  const original = dependencies.database.runs.getRun(runId);
  if (original.kind === 'error') {
    return Promise.resolve(original);
  }

  const sourceInput = original.value.input;
  if (!isRecord(sourceInput)) {
    return Promise.resolve({
      kind: 'error',
      message: formatEngineErrorMessage(
        'malformed_restart_source_input',
        `A(z) "${runId}" futás bemenete nem rekord alakú, tehát nem indítható újra`,
      ),
    });
  }

  return Promise.resolve(
    dependencies.runSupervisor.startRun({
      workflowId: original.value.workflowId,
      input: sourceInput,
      restartedFromRunId: runId,
    }),
  );
}
