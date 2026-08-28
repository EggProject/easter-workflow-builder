import type { StepInstanceReference } from '../run-context/step-instance-reference.ts';

/**
 * Egy **lefutott** agent lépés példány, aminek a `step_run` sorára már
 * ráíródott az SDK session azonosítója (SPEC-004 6.3, "A folytatandó session
 * feloldása"): a példány azonosítója (SPEC-004 4.3) és a session azonosító.
 *
 * **Miért nem a nyers `StepRunRecord` a bemenet.** A `step_run` sor nem
 * hordozza az ág kontextust, csak a hatókört nyitó lépés futásának
 * azonosítóját (`parent_step_run_id`, SPEC-004 4.3 táblázat), a 6.3 feloldás
 * viszont a **teljes** ág kontextus előtag szabályára épül. Az ág kontextust a
 * futás vezetője tartja nyilván, ugyanabban a nyilvántartásban, amiből az
 * `ExecutedStepInstance` lista is származik (`run-context` téma), ezért a lista
 * összeállítása a hívó dolga: a `sdkSessionId` a lépés `step_run` sorából jön,
 * a `nodeId` és a `branchContext` pedig a példány nyilvántartásából.
 *
 * A `null` `sdk_session_id` értékű sorok **nem** kerülnek a listába: a 6.3
 * szekció szerint a keresés az első olyan ős példányt adja, "aminek van nem
 * NULL `sdk_session_id` értéke", tehát a szűrés a lista összeállításakor
 * történik, és így a típus szintjén sem keletkezik nullázható mező.
 */
export interface SessionBearingInstance extends StepInstanceReference {
  readonly sdkSessionId: string;
}
