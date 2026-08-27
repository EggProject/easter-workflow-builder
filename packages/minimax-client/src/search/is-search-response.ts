import { isRecord } from '@easter-workflow-builder/typeguards';
import type { MiniMaxSearchResponse, MiniMaxSearchResult } from './search-response.ts';

function isSearchResult(value: unknown): value is MiniMaxSearchResult {
  return (
    isRecord(value) &&
    typeof value['title'] === 'string' &&
    typeof value['link'] === 'string' &&
    typeof value['snippet'] === 'string' &&
    typeof value['date'] === 'string'
  );
}

/**
 * Typeguard a kereső válaszra. Az `organic` mezőnek tömbnek kell lennie, és
 * minden elemének a négy szöveges mezőt hordoznia kell.
 */
export function isSearchResponse(value: unknown): value is MiniMaxSearchResponse {
  if (!isRecord(value)) {
    return false;
  }
  const organic = value['organic'];
  return Array.isArray(organic) && organic.every((element: unknown) => isSearchResult(element));
}
