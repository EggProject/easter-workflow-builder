import { describe, expect, it } from 'vitest';
import { testZipFileEntry } from './test-zip-file-entry.ts';

describe('testZipFileEntry', () => {
  it('deflate tömörítésű, Unix szabályos fájl bejegyzést ad, a deklarált méret a tartalom hossza', () => {
    const entry = testZipFileEntry('a.txt', 'abc');
    expect(entry).toMatchObject({
      name: 'a.txt',
      compressionMethod: 8,
      versionMadeBy: 0x3_14,
      declaredUncompressedSize: 3,
    });
    expect(Math.floor(entry.externalFileAttributes / 0x1_00_00)).toBe(0o10_0644);
  });

  it('a felülírás bármely mezőt lecseréli', () => {
    expect(testZipFileEntry('a.txt', Buffer.from('ab'), { declaredUncompressedSize: 9 }).declaredUncompressedSize).toBe(
      9,
    );
  });
});
