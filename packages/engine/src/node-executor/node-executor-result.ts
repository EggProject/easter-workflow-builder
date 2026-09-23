import type { NodeExecutionOutcome } from './node-executor-outcome.ts';

/**
 * Amit a diszpécser (`execute-node.ts`) egy node példány végrehajtása után ad
 * vissza: vagy egy LEZÁRULT példány kimenete (`NodeExecutionOutcome`, ami
 * mindig hordoz terminális `step_run` rekordot), vagy a külső megszakítás
 * jelzése (T-005-31, SPEC-004 9. szekció, 10.2 szekció).
 *
 * **Miért külön típus, és miért nem a `NodeExecutionOutcome` új ága.** A
 * `NodeExecutionOutcome` minden ága hordoz lezárt `stepRun` rekordot, és
 * kilenc végrehajtó közül nyolc kizárólag ilyen ágat tud adni. Ha a
 * megszakítás annak az uniónak lenne az ága, a `stepRun` mező elveszítené a
 * "mindig van" garanciáját MINDEN végrehajtó kimenetén, nem csak azon az
 * egyen, ahol a megszakítás egyáltalán előfordulhat - a hívóknak olyan
 * helyeken is szűkíteniük kellene, ahol az ág típusilag sosem áll elő. A
 * szélesebb típus ezért csak ott jelenik meg, ahol tényleges jelentése van: a
 * `human_approval` és a két agent lépés (`agent_step`, `join` `ai_synthesis`)
 * végrehajtójánál, a diszpécsernél és a léptető huroknál.
 *
 * **Az `interrupted` ág nem hordoz `stepRun` rekordot**, mert a sor ilyenkor
 * nem terminális (`waiting_approval`, illetve `pending`), és a lezárása a
 * megszakítást kérő fél egyetlen tranzakciójában történik (`cancelRunTree`
 * `cancelled`-del, illetve `recoverInterruptedRuns` `interrupted`-del,
 * `approval-wait-signal.ts`). A hívó (`run-supervisor/advance-run.ts`) ezen az
 * ágon sem `SchedulingEvent`-et nem épít, sem a lefutott példányok közé nem
 * veszi fel a példányt: a futás léptetése ekkor amúgy is a `stopRequested`
 * jelzés alatt áll, tehát a hurok nem indít több lépést és a záró állapotot
 * sem ő írja (`ActiveRunHandle.requestStop` doksija).
 *
 * Két helyen keletkezhet az `interrupted` ág:
 *
 * - a `human_approval` végrehajtójában (`execute-human-approval.ts`): egy
 *   korlátlan várakozású jóváhagyásnak nincs `AgentQuery`-je, amin
 *   `interrupt()`-et lehetne hívni, ezért a várakozását az
 *   `ApprovalWaitRegistry.cancelWaitingForRunIds` zárja le;
 * - az agent lépés közös életciklusában (`agent-node-lifecycle.ts`), ha a
 *   szabályos leállás lezárta a szabályozót, mielőtt a lépés helyet kapott
 *   (SPEC-004 10.2 1. pont). A sor ekkor `pending` állapotban marad.
 *
 * A már futó agent lépéseket a `interruptLiveAgentQueries` szakítja meg, ott
 * az SDK folyam kimerítése után a lépés a szokásos ágak valamelyikén, lezárt
 * sorral zár.
 */
export type NodeExecutionResult = NodeExecutionOutcome | { readonly kind: 'interrupted' };
