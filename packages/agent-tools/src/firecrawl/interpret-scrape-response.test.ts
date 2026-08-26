import { describe, expect, it } from 'vitest';
import { interpretScrapeResponse } from './interpret-scrape-response.ts';

describe('interpretScrapeResponse', () => {
  it('hibaágat ad nem objektum válaszra', () => {
    expect(interpretScrapeResponse('szoveg').kind).toBe('error');
  });

  it('hibaágat ad, ha a success hamis, és továbbadja az indoklást', () => {
    const outcome = interpretScrapeResponse({ success: false, error: 'nincs ilyen oldal' });
    if (outcome.kind !== 'error') {
      throw new Error('hibaágat vártunk');
    }
    expect(outcome.message).toContain('nincs ilyen oldal');
  });

  it('hibaágat ad, ha a success hamis és nincs indoklás', () => {
    const outcome = interpretScrapeResponse({ success: false });
    if (outcome.kind !== 'error') {
      throw new Error('hibaágat vártunk');
    }
    expect(outcome.message).toContain('indoklás nélkül');
  });

  it('hibaágat ad, ha a sikeres válaszban nincs dokumentum', () => {
    expect(interpretScrapeResponse({ success: true }).kind).toBe('error');
  });

  it('hibaágat ad, ha nincs markdown tartalom', () => {
    expect(interpretScrapeResponse({ success: true, data: { metadata: {} } }).kind).toBe('error');
  });

  it('kiolvassa a tartalmat, a címet és a forráscímet', () => {
    const outcome = interpretScrapeResponse({
      success: true,
      data: { markdown: '# Cim', metadata: { title: 'Oldal', sourceURL: 'https://a.example' } },
    });
    expect(outcome).toStrictEqual({
      kind: 'ok',
      value: { markdown: '# Cim', title: 'Oldal', sourceUrl: 'https://a.example' },
    });
  });

  it('hiányzó metaadat esetén üres címet és forráscímet ad', () => {
    const outcome = interpretScrapeResponse({ success: true, data: { markdown: 'tartalom' } });
    expect(outcome).toStrictEqual({ kind: 'ok', value: { markdown: 'tartalom', title: '', sourceUrl: '' } });
  });
});
