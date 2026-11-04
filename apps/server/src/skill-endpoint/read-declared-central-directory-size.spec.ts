import { describe, expect, it } from 'vitest';
import { buildTestZipArchive } from './build-test-zip-archive.ts';
import { readDeclaredCentralDirectorySize } from './read-declared-central-directory-size.ts';
import { testZipFileEntry } from './test-zip-file-entry.ts';
import { withZip64EndRecord } from './with-zip64-end-record.ts';

// APPNOTE 4.3.12: a központi könyvtár rekord 46 bájt plusz a név (a tesztcsomagban nincs extra mező és megjegyzés).
const CENTRAL_RECORD_SIZE = 46;
const ENTRIES = [testZipFileEntry('a.txt', 'a'), testZipFileEntry('mappa/b.txt', 'b')];
const EXPECTED_SIZE = 2 * CENTRAL_RECORD_SIZE + 'a.txt'.length + 'mappa/b.txt'.length;

describe('readDeclaredCentralDirectorySize', () => {
  it('a záró rekord méret mezőjét adja', () => {
    expect(readDeclaredCentralDirectorySize(buildTestZipArchive(ENTRIES))).toBe(EXPECTED_SIZE);
  });

  it('ZIP64 helymutató esetén a ZIP64 záró rekord méret mezőjét adja', () => {
    const archive = buildTestZipArchive(ENTRIES);
    expect(readDeclaredCentralDirectorySize(withZip64EndRecord(archive))).toBe(EXPECTED_SIZE);
    expect(readDeclaredCentralDirectorySize(withZip64EndRecord(archive, 5))).toBe(5);
  });

  it('a csak záró rekordból álló üres csomagra 0 (a helymutató helye a fájl elé esne)', () => {
    expect(readDeclaredCentralDirectorySize(buildTestZipArchive([]))).toBe(0);
  });

  it('a megjegyzésben álló aláírást nem tekinti záró rekordnak, ha az a fájl utolsó 22 bájtjába esik', () => {
    const archive = buildTestZipArchive(ENTRIES);
    const comment = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
    const withComment = Buffer.concat([archive, comment]);
    withComment.writeUInt16LE(comment.length, archive.length - 2);
    expect(readDeclaredCentralDirectorySize(withComment)).toBe(EXPECTED_SIZE);
  });
});
