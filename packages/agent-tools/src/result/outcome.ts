/**
 * Kétállapotú eredmény típus: vagy egy érték, vagy egy az agentnek szánt,
 * emberi nyelvű hibaüzenet. A csomag egyetlen rétege sem dob kivételt a hívó
 * felé, mert a tool hibája nem szakíthatja meg az agent futását: az agentnek
 * el kell tudnia dönteni, hogy megpróbál valami mást.
 */
export type Outcome<TValue> =
  { readonly kind: 'ok'; readonly value: TValue } | { readonly kind: 'error'; readonly message: string };
