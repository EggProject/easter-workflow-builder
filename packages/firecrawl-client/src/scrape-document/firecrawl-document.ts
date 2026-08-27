/**
Egy letöltött oldal a Firecrawl válaszából, csak azokkal a mezőkkel, amiket az agent lát.
*/
export interface FirecrawlDocument {
  readonly markdown: string;
  readonly title: string;
  readonly sourceUrl: string;
}
