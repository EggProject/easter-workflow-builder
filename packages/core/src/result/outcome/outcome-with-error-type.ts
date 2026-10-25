/**
 * Az `Outcome<TValue>` alakja egy opcionális naplózási adattal a hibaágon: ha a
 * hibaág egy elkapott, előre nem látott kivételből származik, az
 * `unexpectedErrorType` annak típusneve (`describeErrorType`), az üzenete nem
 * (SPEC-010 O-22). Az `Outcome` maga változatlanul csak `message` mezőt hordoz
 * (SPEC-005 F-22); a két típus kölcsönösen értékadható, tehát egy ilyen
 * eredményt váró hívó `Outcome` értéket is kaphat, és fordítva. A
 * `workflow-language` csomag és a szerver naplózó burkolója közötti szerződés.
 */
export type OutcomeWithErrorType<TValue> =
  | { readonly kind: 'ok'; readonly value: TValue }
  | { readonly kind: 'error'; readonly message: string; readonly unexpectedErrorType?: string };
