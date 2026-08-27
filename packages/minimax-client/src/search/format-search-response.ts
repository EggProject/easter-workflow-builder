import type { MiniMaxSearchResult } from './search-response.ts';

/**
 * A találatok agent számára olvasható szöveggé alakítása. A dátum csak akkor
 * kerül a kimenetbe, ha a szolgáltatás küldött ilyet: a mérés szerint ez a mező
 * gyakran üres string.
 */
export function formatSearchResponse(results: readonly MiniMaxSearchResult[]): string {
  if (results.length === 0) {
    return 'A keresés nem adott találatot. Próbáld más kulcsszavakkal.';
  }
  return results
    .map((result, index) => {
      const dateSuffix = result.date.length > 0 ? ` (${result.date})` : '';
      return `${String(index + 1)}. ${result.title}${dateSuffix}\n${result.link}\n${result.snippet}`;
    })
    .join('\n\n');
}
