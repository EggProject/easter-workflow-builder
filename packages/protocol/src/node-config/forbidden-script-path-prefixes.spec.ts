import { describe, expect, it } from 'vitest';
import { FORBIDDEN_SCRIPT_PATH_PREFIXES } from './forbidden-script-path-prefixes.ts';

describe('FORBIDDEN_SCRIPT_PATH_PREFIXES', () => {
  it('a user döntése szerinti két könyvtár (2026-11-04, "/proc és /dev tiltva")', () => {
    expect(FORBIDDEN_SCRIPT_PATH_PREFIXES).toStrictEqual(['/proc', '/dev']);
  });
});
