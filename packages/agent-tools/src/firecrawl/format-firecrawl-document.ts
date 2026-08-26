import type { FirecrawlDocument } from './firecrawl-document.ts';

/**
 * A letöltött oldal agent számára olvasható szöveggé alakítása. A cím és a
 * forráscím csak akkor kerül a kimenet elejére, ha a Firecrawl küldött ilyet.
 */
export function formatFirecrawlDocument(document: FirecrawlDocument): string {
  const headerLines: string[] = [];
  if (document.title.length > 0) {
    headerLines.push(`Cím: ${document.title}`);
  }
  if (document.sourceUrl.length > 0) {
    headerLines.push(`Forrás: ${document.sourceUrl}`);
  }
  if (headerLines.length === 0) {
    return document.markdown;
  }
  return `${headerLines.join('\n')}\n\n${document.markdown}`;
}
