import type { ApprovalDecision } from '@easter-workflow-builder/db';

/**
 * Amivel egy `human_approval` lépés döntésre várása KÍVÜLRŐL véget érhet
 * (SPEC-004 5.8, 9. szekció 2 ... 5. pont). A `ApprovalWaitRegistry
 * .waitForDecision` ezt adja vissza, nem közvetlenül az `ApprovalDecision`
 * uniót:
 *
 * - `decided`: megérkezett az ember hozta döntés (`notifyDecided`), a
 *   végrehajtó a szokásos úton zár (visszaolvasott sor, `step_finished` és
 *   `approval_decided` esemény);
 * - `interrupted`: a várakozást a megszakítás vagy a szabályos leállás zárta le
 *   (`cancelWaitingForRunIds`), tehát **nincs döntés**. A végrehajtó ilyenkor
 *   egyetlen állapotváltást és egyetlen eseményt sem ír: a lépés sorát a
 *   megszakítást kérő fél zárja le, egyetlen tranzakcióban, a futás sorával
 *   együtt (`run-interrupt/interrupt-run.ts` `cancelRunTree`, illetve
 *   `shutdown-active-runs.ts` `recoverInterruptedRuns`). A kettő MÁS záró
 *   állapotot ír (`cancelled`, illetve `interrupted`), amit a végrehajtó nem
 *   tudna eldönteni - ezért nem is dönt.
 *
 * A harmadik lehetséges kimenet, az időkorlát lejárata, szándékosan NEM
 * ebben az unióban áll: azt a végrehajtó a `clock.sleep` versenyéből maga
 * ismeri fel, és a regiszternek nincs róla tudomása (a vesztes ág a
 * `cancelWait` hívással FELOLDÁS NÉLKÜL törli a bejegyzést).
 */
export type ApprovalWaitSignal =
  { readonly kind: 'decided'; readonly decision: ApprovalDecision } | { readonly kind: 'interrupted' };
