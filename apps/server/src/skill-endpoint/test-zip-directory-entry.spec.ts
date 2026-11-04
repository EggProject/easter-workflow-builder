import { describe, expect, it } from 'vitest';
import { testZipDirectoryEntry } from './test-zip-directory-entry.ts';

describe('testZipDirectoryEntry', () => {
  it('tárolt, üres, Unix könyvtár bejegyzést ad', () => {
    const entry = testZipDirectoryEntry('a/');
    expect(entry).toMatchObject({ name: 'a/', compressionMethod: 0, declaredUncompressedSize: 0 });
    expect(Math.floor(entry.externalFileAttributes / 0x1_00_00)).toBe(0o4_0755);
  });
});
