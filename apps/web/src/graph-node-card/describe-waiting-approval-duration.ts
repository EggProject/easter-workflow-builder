/**
 * A "mióta vár" felirat a `waiting_approval` összesítéshez (SPEC-008 8.
 * szekció, T-009-27). Tiszta függvény: a "most" időpontot a hívó adja át
 * (`Date.now()` a `GraphNodeCard` render törzsében), nem ez a fájl olvassa,
 * hogy szintetikus bemenettel determinisztikusan tesztelhető maradjon.
 *
 * **Nincs `setInterval` alapú újrarajzolás.** A felirat a legutóbbi renderkor
 * frissül, nem másodpercenként: a projekt egyetlen termékkód fájlja sem hív
 * `setInterval`-t egy kitalált, dokumentálatlan időközzel
 * (`greppable-invariants.spec.ts` (8) pont, `.claude/CLAUDE.md` 6. szekció:
 * "sosem szabad tippelgetni... nincs dokumentált szabály az értékre"). Futás
 * közben a nézet amúgy is gyakran renderel újra élő SSE keretekre (a lépés
 * futás lista, a transcript, a futás rekordja mind ezen az úton frissül,
 * `run-view/use-live-step-runs.ts`), tehát a felirat a gyakorlatban naprakész
 * marad; ha éppen nincs friss keret, a szám egy darabig elavulhat, ez a
 * legkisebb, indokolt megoldás egy külön időzítő bevezetése helyett.
 */
export function describeWaitingApprovalDuration(requestedAtMs: number, nowMs: number): string {
  const elapsedSeconds = Math.max(0, Math.floor((nowMs - requestedAtMs) / 1000));
  if (elapsedSeconds < 60) {
    return `${String(elapsedSeconds)} másodperce vár`;
  }
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) {
    return `${String(elapsedMinutes)} perce vár`;
  }
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  return `${String(elapsedHours)} órája vár`;
}
