/* eslint-disable unicorn/no-null -- a `memoryLimitMb` üres értéke a tárolt `null` (SPEC-014 5.3) */
import { totalmem } from 'node:os';
import { describe, expect, it } from 'vitest';
import { resolveMemoryLimitMb } from './resolve-memory-limit-mb.ts';

describe('resolveMemoryLimitMb', () => {
  it('a beállított értéket változatlanul adja', () => {
    expect(resolveMemoryLimitMb(16)).toBe(16);
    expect(resolveMemoryLimitMb(2048)).toBe(2048);
  });

  it('a null a rendszermemória egész MB-ban, legfeljebb 2048', () => {
    const systemMb = Math.floor(totalmem() / 2 ** 20);
    expect(resolveMemoryLimitMb(null)).toBe(Math.min(systemMb, 2048));
    expect(resolveMemoryLimitMb(null)).toBeLessThanOrEqual(2048);
  });
});
