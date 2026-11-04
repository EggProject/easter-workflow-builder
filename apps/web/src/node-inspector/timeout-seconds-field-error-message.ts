/**
 * A JavaScript szkript időkorlát mezőjének hibamondata (SPEC-014 5.3, 5.9).
 * A mező másodpercben szerkeszt, a mentési séma viszont a tárolt
 * ezredmásodperc értéket ellenőrzi, és a saját mondata ezredmásodpercben szól
 * ("legfeljebb 2147483647"), ami a másodperces mezőn félrevezető. Ez a mondat
 * ugyanazt a két szabályt mondja ki másodpercben: pozitív, legfeljebb
 * ezredmásodperc pontosságú szám (a séma pozitív egész szabálya), és
 * legfeljebb 2 147 483,647 másodperc (a 2147483647 ms-os felső határ, J-16).
 * A mező alatt bármely séma hiba helyett ez áll (PLAN-015 T-015-12).
 */
export const TIMEOUT_SECONDS_FIELD_ERROR_MESSAGE =
  'Az időkorlát pozitív szám legyen másodpercben, legfeljebb három tizedesjeggyel, és legfeljebb 2 147 483,647 másodperc.';
