/**
Egy Firecrawl hívás feloldott konfigurációja. Önállóan futó példányhoz nincs API kulcs mező.
*/
export interface FirecrawlConfig {
  readonly baseUrl: string;
  readonly timeoutMs: number;
}
