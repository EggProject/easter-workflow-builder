import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';
import type { RunCompletion } from './run-completion.ts';
import type { UnhandledErrorRecord } from './unhandled-error-record.ts';

/**
 * A futás záró állapota (SPEC-004 8.4, "A részben sikeres futás"), tiszta
 * függvényben: adatbázist nem érint, portot nem hív.
 *
 * A szabály szó szerint: **a futás `failed` állapotban zár, ha bármely ág
 * kezeletlen hibával halt el**, akkor is, ha az `onUnhandledError` értéke
 * `fail_branch` volt, és akkor is, ha a többi ág sikeresen befejeződött. A
 * `workflow_run.error_kind` az **első** kezeletlen hiba osztálya, az
 * `error_message` pedig megnevezi, hány ág halt el.
 *
 * **Nincs `partially_succeeded` állapot.** A spec megnevezi és el is veti ezt
 * az alternatívát: a `RunStatus` unió és az átmeneti tábla a SPEC-003
 * hatóköre, tehát a bővítés ott igényelne user döntést, és egy `succeeded`
 * jellegű állapot elrejtené, hogy a futásban kezeletlen hiba volt. A
 * részeredmény nem vész el: minden sikeres lépés kimenete a `step_run`
 * soraiban áll.
 *
 * A bemenet **időrendben** rendezett lista; a `run-supervisor` (T-005-25)
 * abban a sorrendben fűzi hozzá a bejegyzéseket, ahogy a kezeletlen hibák
 * bekövetkeztek, tehát ez a függvény nem rendez és nem hasonlít időbélyeget.
 */
export function resolveRunCompletion(unhandledErrors: readonly UnhandledErrorRecord[]): RunCompletion {
  const [first] = unhandledErrors;
  if (first === undefined) {
    /* eslint-disable-next-line unicorn/no-null -- a `RunCompletion.errorKind`/`errorMessage` `null` értéke a "hiba nélkül zárt" jelentés, a `RunFinishedPayload` szerződése szerint (SPEC-004 13. szekció) */
    return { status: 'succeeded', errorKind: null, errorMessage: null, failedBranchCount: 0 };
  }

  const failedBranchCount = unhandledErrors.length;
  const errorMessage = formatEngineErrorMessage(
    first.errorKind,
    `A(z) ${first.nodeId} node kezeletlen hibája miatt a futás sikertelen; elhalt ágak száma: ${String(failedBranchCount)}`,
  );

  return { status: 'failed', errorKind: first.errorKind, errorMessage, failedBranchCount };
}
