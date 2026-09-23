/**
 * Egy REST hívás hibaága: az `Outcome` hibaága, kiegészítve azzal, hogy a hiba
 * ÁTMENETI-e. Átmeneti, ha a kérés el sem jutott a szerver alkalmazás
 * logikájáig, és a szerver visszatérése magától megszünteti:
 *
 * - hálózati hiba (a `fetch` elutasít, nincs válasz),
 * - HTTP 502: a proxy nem kapott érvényes választ a mögötte álló szervertől
 *   (RFC 9110 15.6.3). A fejlesztői Vite proxy pontosan ezt adja, ha a backend
 *   nem fogad kapcsolatot (Vite 8 changelog, #21652),
 * - HTTP 503: a szerver átmenetileg nem tudja kiszolgálni a kérést (RFC 9110
 *   15.6.4, "likely be alleviated after some delay").
 *
 * Minden más hiba (útvonal, protokoll hiba más státusszal, hibás JSON, séma
 * eltérés) nem átmeneti, mert a szerver ugyanarra a kérésre ugyanazt adná.
 */
export interface RouteFailure {
  readonly kind: 'error';
  readonly message: string;
  readonly isTransient: boolean;
}

/**
 * A REST réteg eredmény típusa. Az `Outcome<TValue>` helyére bárhol
 * beírható (a hibaág a `kind` és a `message` mezőt ugyanúgy hordozza), tehát
 * a hívók, akiknek az átmeneti jelző nem számít, változatlanul `Outcome`-ként
 * kezelhetik.
 */
export type RouteOutcome<TValue> = RouteFailure | { readonly kind: 'ok'; readonly value: TValue };
