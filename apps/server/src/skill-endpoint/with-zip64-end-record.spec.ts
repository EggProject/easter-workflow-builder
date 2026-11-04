import { describe, expect, it } from 'vitest';
import { fromBufferPromise } from 'yauzl';
import { buildTestZipArchive } from './build-test-zip-archive.ts';
import { testZipFileEntry } from './test-zip-file-entry.ts';
import { withZip64EndRecord } from './with-zip64-end-record.ts';

describe('withZip64EndRecord', () => {
  it('a yauzl a ZIP64 záró rekordból olvassa a bejegyzésszámot és a központi könyvtárat', async () => {
    const archive = buildTestZipArchive([testZipFileEntry('a.txt', 'a'), testZipFileEntry('b.txt', 'b')]);
    const zipFile = await fromBufferPromise(withZip64EndRecord(archive));
    const names: string[] = [];
    for await (const entry of zipFile.eachEntry()) {
      names.push(entry.fileName);
    }
    zipFile.close();

    expect(zipFile.entryCount).toBe(2);
    expect(names).toStrictEqual(['a.txt', 'b.txt']);
  });

  it('a megadott méretet írja a ZIP64 rekordba', () => {
    const archive = withZip64EndRecord(buildTestZipArchive([testZipFileEntry('a.txt', 'a')]), 7);
    const recordStart = archive.length - 22 - 20 - 56;
    expect(archive.readBigUInt64LE(recordStart + 40)).toBe(7n);
  });
});
