import { describe, expect, it } from 'vitest';
import { readPixels } from './read-pixels.ts';

describe('readPixels', () => {
  it('a px végű kiszámított érték a pixel száma, tört értékkel is', () => {
    expect(readPixels('60px')).toBe(60);
    expect(readPixels('0.5px')).toBe(0.5);
  });

  it('nem pixeles (auto vagy üres) érték nulla', () => {
    expect(readPixels('auto')).toBe(0);
    expect(readPixels('')).toBe(0);
  });
});
