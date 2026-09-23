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
 * - `interrupted`: a várakozást a megszakítás, a szabályos leállás vagy a
 *   futás `fail_run` politikájú bukása zárta le (`cancelWaitingForRunIds`),
 *   tehát **nincs döntés**. A végrehajtó ilyenkor egyetlen állapotváltást és
 *   egyetlen eseményt sem ír: a lépés sorát a lezárást kérő fél zárja le, a
 *   várakozás lezárásával egy szinkron menetben
 *   (`closeWaitingApprovalStepRuns`), hogy a leállási ablakban érkező döntés
 *   a sor állapotán bukjon. A megszakítás (`run-interrupt/interrupt-run.ts`)
 *   és a `fail_run` (`run-supervisor/advance-run.ts`) `cancelled`, a
 *   szabályos leállás (`shutdown-active-runs.ts`) `interrupted` állapotba
 *   zár. A záró állapot hívónként más, amit a végrehajtó nem tudna
 *   eldönteni - ezért nem is dönt.
 *
 * A harmadik lehetséges kimenet, az időkorlát lejárata, szándékosan NEM
 * ebben az unióban áll: azt a végrehajtó a `clock.sleep` versenyéből maga
 * ismeri fel, és a regiszternek nincs róla tudomása (a vesztes ág a
 * `cancelWait` hívással FELOLDÁS NÉLKÜL törli a bejegyzést).
 */
export type ApprovalWaitSignal =
  { readonly kind: 'decided'; readonly decision: ApprovalDecision } | { readonly kind: 'interrupted' };
