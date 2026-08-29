import { describe, expect, it } from 'vitest';
import { normalizeIncomingRequest } from './normalize-incoming-request.ts';

describe('normalizeIncomingRequest', () => {
  it('kitöltött url és method esetén a pathname-et, a query-t és a metódust adja', () => {
    const result = normalizeIncomingRequest('/api/workflows?limit=10', 'GET');
    expect(result.method).toBe('GET');
    expect(result.pathname).toBe('/api/workflows');
    expect(result.searchParams.get('limit')).toBe('10');
  });

  it('hiányzó url esetén a gyökér útvonalra esik vissza', () => {
    const result = normalizeIncomingRequest(undefined, 'GET');
    expect(result.pathname).toBe('/');
  });

  it('hiányzó method esetén üres sztringre esik vissza', () => {
    const result = normalizeIncomingRequest('/api/workflows', undefined);
    expect(result.method).toBe('');
  });
});
