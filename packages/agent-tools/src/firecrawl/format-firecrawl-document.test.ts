import { describe, expect, it } from 'vitest';
import { formatFirecrawlDocument } from './format-firecrawl-document.ts';

describe('formatFirecrawlDocument', () => {
  it('cím és forráscím nélkül csak a tartalmat adja', () => {
    expect(formatFirecrawlDocument({ markdown: 'tartalom', title: '', sourceUrl: '' })).toBe('tartalom');
  });

  it('csak a meglévő fejlécsorokat teszi a tartalom elé', () => {
    expect(formatFirecrawlDocument({ markdown: 'tartalom', title: 'Oldal', sourceUrl: '' })).toBe(
      'Cím: Oldal\n\ntartalom',
    );
    expect(formatFirecrawlDocument({ markdown: 'tartalom', title: '', sourceUrl: 'https://a.example' })).toBe(
      'Forrás: https://a.example\n\ntartalom',
    );
  });

  it('mindkét fejlécsort kiírja, ha megvan', () => {
    expect(formatFirecrawlDocument({ markdown: 'tartalom', title: 'Oldal', sourceUrl: 'https://a.example' })).toBe(
      'Cím: Oldal\nForrás: https://a.example\n\ntartalom',
    );
  });
});
