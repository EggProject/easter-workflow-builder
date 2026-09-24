import type { RouteFailure } from '../rest-client/route-outcome.ts';

/**
 * Egy újratöltött erőforrás (a futás rekordja, a lépés futások) hibájából a
 * képernyő HELYÉN megjelenő üzenet, vagy `undefined`, ha a hiba nem blokkoló.
 *
 * Nem blokkoló az a hiba, ami átmeneti (`RouteFailure.isTransient`), ÉS van
 * korábbi sikeres betöltés, ami helyette látszhat: ilyenkor az utolsó ismert
 * állapot marad, és a képernyő csak jelzi a várakozást. Blokkoló minden más:
 * a nem átmeneti hiba, mert azt egy szerver újraindulás sem szünteti meg, és
 * az átmeneti hiba is, ha nincs korábbi érték, mert akkor nincs mit mutatni.
 */
export function blockingFailureMessage(failure: RouteFailure | undefined, hasLastValue: boolean): string | undefined {
  if (failure === undefined || (hasLastValue && failure.isTransient)) {
    return undefined;
  }
  return failure.message;
}
