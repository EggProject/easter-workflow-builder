import { describe, expect, it } from 'vitest';
import { fromBufferPromise } from 'yauzl';
import { buildTestZipArchive } from './build-test-zip-archive.ts';
import { testZipDirectoryEntry } from './test-zip-directory-entry.ts';
import { testZipFileEntry } from './test-zip-file-entry.ts';

describe('buildTestZipArchive', () => {
  it('a yauzl által olvasható csomagot épít a megadott fejléc mezőkkel', async () => {
    const archive = buildTestZipArchive([
      testZipDirectoryEntry('a/'),
      testZipFileEntry('a/b.txt', 'tartalom'),
      testZipFileEntry('c.bin', Buffer.from([1, 2, 3]), { compressionMethod: 0, name: Buffer.from('c.bin') }),
    ]);
    const zipFile = await fromBufferPromise(archive);
    const entries = [];
    for await (const entry of zipFile.eachEntry()) {
      entries.push({ name: entry.fileName, method: entry.compressionMethod, size: entry.uncompressedSize });
    }
    zipFile.close();

    expect(entries).toStrictEqual([
      { name: 'a/', method: 0, size: 0 },
      { name: 'a/b.txt', method: 8, size: 8 },
      { name: 'c.bin', method: 0, size: 3 },
    ]);
  });
});
