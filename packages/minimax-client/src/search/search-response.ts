/**
Egy találat a MiniMax kereső válaszában.
*/
export interface MiniMaxSearchResult {
  readonly title: string;
  readonly link: string;
  readonly snippet: string;
  readonly date: string;
}

/**
 * A kereső válasz azon része, amit az eszköz felhasznál. A `related_searches`
 * mező szándékosan nincs benne: a séma és a kimenet is akkor a legegyszerűbb,
 * ha csak a tényleges találatok kerülnek az agent elé.
 */
export interface MiniMaxSearchResponse {
  readonly organic: readonly MiniMaxSearchResult[];
}
