/**
 * A "mióta vár" felirat a `waiting_approval` összesítéshez (SPEC-008 8.
 * szekció, T-009-27): a jóváhagyás kérésének ABSZOLÚT időpontja, a böngésző
 * helyi idejében, például "10:32:05 óta vár" (user döntés 2026-09-24).
 *
 * Az időpont alakja a projekt meglévő időformázása: `toLocaleTimeString`
 * magyar területi beállítással, ugyanaz, mint a transcript sorok
 * időbélyege (`run-event-row/RunEventRow.tsx` `formatOccurredAt`).
 *
 * **Nincs időzítő.** Egy abszolút időpont a render pillanatától függetlenül
 * igaz marad, tehát nem kell újrarajzolni ahhoz, hogy naprakész legyen; egy
 * relatív ("N perce vár") felirat ezzel szemben időzítő nélkül elavulna.
 */
export function describeWaitingApprovalSince(requestedAtMs: number): string {
  return `${new Date(requestedAtMs).toLocaleTimeString('hu-HU')} óta vár`;
}
