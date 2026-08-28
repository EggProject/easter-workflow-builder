/**
 * A lépés session kötése (SPEC-004 6.3 táblázat), a kimenő `Options`
 * session mezőinek forrása:
 *
 * - `isolated`: friss session, tehát a kimenő objektumban **nincs** `resume`
 *   és **nincs** `forkSession` mező (29. elfogadási kritérium).
 * - `continued`: a `resume` a legközelebbi ős lépés `sdk_session_id` értéke, a
 *   `forkSession` pedig a `resolveForkSession` tiszta függvény eredménye
 *   (6.4).
 *
 * Harmadik ág nincs: ha `continued` módban nincs folytatható ős session, a
 * feloldás `no_resumable_session` hibát ad, és a motor **nem** indít helyette
 * friss sessiont (6.3, 31. elfogadási kritérium).
 *
 * A `persistSession` szándékosan nem ennek a típusnak a mezője: az minden
 * lépésnél `true`, tehát nem a session kötéstől függ (6.3, 32. elfogadási
 * kritérium), és az `AgentStepOptions` konstans mezőjeként áll.
 */
export type SessionBinding =
  | { readonly mode: 'isolated' }
  | { readonly mode: 'continued'; readonly resume: string; readonly forkSession: boolean };
