import { isNonEmptyString, isRecord } from '@easter-workflow-builder/typeguards';
import type { Outcome } from '../result/outcome.ts';
import type { FirecrawlDocument } from './firecrawl-document.ts';

/**
Egy szöveges mező kiolvasása ismeretlen alakú rekordból, hiány esetén üres stringgel.
*/
function readStringField(source: unknown, fieldName: string): string {
  if (!isRecord(source)) {
    return '';
  }
  const value = source[fieldName];
  return isNonEmptyString(value) ? value : '';
}

/**
 * A Firecrawl scrape válaszának értelmezése. A `success` mező hamis értéke a
 * szolgáltatás saját hibája, ilyenkor a válasz `error` mezője megy tovább az
 * agentnek. A cím és a forráscím hiánya nem hiba, csak üres marad, a markdown
 * tartalom hiánya viszont igen: enélkül az eszköznek nincs mit visszaadnia.
 */
export function interpretScrapeResponse(value: unknown): Outcome<FirecrawlDocument> {
  if (!isRecord(value)) {
    return { kind: 'error', message: 'A Firecrawl válasza nem értelmezhető objektum.' };
  }
  if (value['success'] !== true) {
    const reason = readStringField(value, 'error');
    return {
      kind: 'error',
      message:
        reason.length > 0
          ? `A Firecrawl elutasította a letöltést: ${reason}`
          : 'A Firecrawl sikertelen letöltést jelentett, indoklás nélkül.',
    };
  }
  const data = value['data'];
  if (!isRecord(data)) {
    return { kind: 'error', message: 'A Firecrawl sikert jelentett, de nincs a válaszban letöltött dokumentum.' };
  }
  const markdown = data['markdown'];
  if (!isNonEmptyString(markdown)) {
    return { kind: 'error', message: 'A Firecrawl válaszában nincs markdown tartalom, az oldal nem olvasható be.' };
  }
  const metadata = data['metadata'];
  return {
    kind: 'ok',
    value: {
      markdown,
      title: readStringField(metadata, 'title'),
      sourceUrl: readStringField(metadata, 'sourceURL'),
    },
  };
}
