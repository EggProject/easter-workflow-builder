import { describe, expect, it } from 'vitest';
import { formatSearchResponse } from './format-search-response.ts';

describe('formatSearchResponse', () => {
  it('üres találatlistára segítő szöveget ad', () => {
    expect(formatSearchResponse([])).toContain('nem adott találatot');
  });

  it('sorszámozza a találatokat, és elhagyja az üres dátumot', () => {
    const text = formatSearchResponse([
      { title: 'Elso', link: 'https://a.example', snippet: 'kivonat', date: '' },
      { title: 'Masodik', link: 'https://b.example', snippet: 'masik', date: '2026-08-26' },
    ]);
    expect(text).toContain('1. Elso\nhttps://a.example\nkivonat');
    expect(text).toContain('2. Masodik (2026-08-26)');
  });
});
