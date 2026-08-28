/**
 * Egy `fan_out` node példány kibontásának eredménye (SPEC-004 4.5). A
 * nyilvántartás kulcsa a `fan_out` node **példánya**, tehát a
 * `(nodeId, külső ág kontextus)` pár, mert ugyanaz a `fan_out` node egy
 * külső hatókörben többször is futhat.
 *
 * **Miért van `dead` ág.** A hozzá tartozó `join` node bejövő élenként N
 * jelölést vár a belső kontextusokban, a `join` viszont a külső kontextusban
 * fut. Ha a `fan_out` példány sosem bomlott elemekre (halott ágban állt, vagy
 * hibára futott), akkor egyetlen belső kontextus sem nyílt meg, tehát a `join`
 * a jelölésekből sosem tudná meg, hogy már nem érkezik semmi. A `dead`
 * bejegyzés pontosan ezt mondja meg: a `join` példány maga is halott.
 *
 * **Az `items` az elem értékeket is hordozza**, nem csak a darabszámot. A
 * `BranchScope` `fan_out` kerete a SPEC-004 4.3 szerint kizárólag a
 * `stepRunId` és az `itemIndex` mezőt tartalmazza, tehát az elem **értékét**
 * a veremből nem lehet visszaolvasni; a `RunContext.item` mező viszont azt
 * várja (6.1), és a `buildRunContext` bemenetként kéri (T-005-16). Ezért a
 * nyilvántartás itt áll.
 */
export type FanOutExpansion =
  | { readonly kind: 'expanded'; readonly stepRunId: string; readonly items: readonly unknown[] }
  | { readonly kind: 'dead' };
