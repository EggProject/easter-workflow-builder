import { describe, expect, it } from 'vitest';
import { formatBytes } from './format-bytes.ts';

describe('formatBytes', () => {
  it('hiányzó méretre üres szöveg', () => {
    expect(formatBytes(undefined)).toBe('');
  });

  it.each([
    [0, '0 B'],
    [1023, '1023 B'],
    [1024, '1.0 KB'],
    [1536, '1.5 KB'],
    [1024 ** 2 - 1, '1024.0 KB'],
    [1024 ** 2, '1.0 MB'],
    [30_000_000, '28.6 MB'],
    [1024 ** 3 - 1, '1024.0 MB'],
    [1024 ** 3, '1.0 GB'],
    [5 * 1024 ** 3, '5.0 GB'],
  ])('a %d bájt szövege "%s"', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });
});
