/**
 * Igaz, ha a `react-window` `onRowsRendered` jelentése még az érkezés ELŐTTI
 * látható tartományt írja le, tehát nem bizonyítja, hogy az utolsó sor nem
 * látszik (SPEC-008 7.4).
 *
 * A telepített `react-window@2.3.1` (`dist/react-window.js`, `useVirtualizer`)
 * a látható tartományt állapotban tartja, és a sorszám növekedése utáni első
 * renderben még a régi állapotot jelenti, a régi utolsó sorra vágva
 * (`Math.min(itemCount - 1, stopIndexVisible)`). A tartományt egy layout
 * effekt számolja újra, és a lista az új tartományt a következő renderben
 * jelenti. Nem teli listán ezért egy új sor után előbb a régi utolsó sor
 * (például 2 a 4 sorból), majd az új utolsó sor (3 a 4-ből) érkezik, holott a
 * lista közben végig az alján állt (research 19. szekció).
 *
 * A jelentés csak akkor lehet elavult, ha a sorszám az előző jelentés óta nőtt,
 * és a `stopIndex` pontosan az előző jelentés utolsó sora: ha a régi tartomány
 * korábban véget ért, az újraszámolás ugyanott ér véget. Ilyenkor a friss
 * jelentés mindig megérkezik, mert a kirajzolt tartomány a túlrajzolási sávval
 * az új sorig bővül.
 */
export function isPreArrivalRangeReport(
  visibleRows: Readonly<{ stopIndex: number }>,
  rowCount: number,
  previousRowCount: number,
): boolean {
  return rowCount > previousRowCount && visibleRows.stopIndex === previousRowCount - 1;
}
