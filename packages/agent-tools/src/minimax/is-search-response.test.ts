import { describe, expect, it } from 'vitest';
import { isSearchResponse } from './is-search-response.ts';

const RESULT = { title: 'c', link: 'https://a.example', snippet: 's', date: '' };

describe('isSearchResponse', () => {
  it('hamisat ad nem objektum értékre', () => {
    expect(isSearchResponse(42)).toBe(false);
  });

  it('hamisat ad, ha az organic mező nem tömb', () => {
    expect(isSearchResponse({ organic: 'nem tomb' })).toBe(false);
  });

  it('hamisat ad, ha egy találat mezője hiányzik vagy rossz típusú', () => {
    expect(isSearchResponse({ organic: [{ title: 'c' }] })).toBe(false);
    expect(isSearchResponse({ organic: ['nem objektum'] })).toBe(false);
  });

  it('igazat ad üres találatlistára', () => {
    expect(isSearchResponse({ organic: [] })).toBe(true);
  });

  it('igazat ad teljes találatlistára', () => {
    expect(isSearchResponse({ organic: [RESULT] })).toBe(true);
  });
});
