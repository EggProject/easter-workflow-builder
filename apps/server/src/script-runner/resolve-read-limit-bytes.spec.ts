/* eslint-disable unicorn/no-null -- a mező üres értéke a tárolt `null` (SPEC-014 5.3) */
import { describe, expect, it } from 'vitest';
import { resolveReadLimitBytes } from './resolve-read-limit-bytes.ts';

describe('resolveReadLimitBytes', () => {
  it('a null az alapérték, bájtban', () => {
    expect(resolveReadLimitBytes(null, 50, 2048)).toBe(50 * 1024 * 1024);
  });

  it('a megadott érték felülírja az alapértéket', () => {
    expect(resolveReadLimitBytes(7, 50, 2048)).toBe(7 * 1024 * 1024);
  });

  it('legfeljebb a lépés memória korlátja', () => {
    expect(resolveReadLimitBytes(null, 50, 16)).toBe(16 * 1024 * 1024);
    expect(resolveReadLimitBytes(1024, 50, 64)).toBe(64 * 1024 * 1024);
  });
});
