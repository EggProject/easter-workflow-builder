import type { TestZipEntry } from './build-test-zip-archive.ts';

// Unix gazdán készült bejegyzés: a "version made by" felső bájtja 3 (APPNOTE 4.4.2).
const UNIX_VERSION_MADE_BY = 0x3_14;
// Szabályos fájl, 0644 jogosultsággal, a külső attribútum felső 16 bitjén (Info-ZIP konvenció).
const REGULAR_FILE_ATTRIBUTES = 0o10_0644 * 0x1_00_00;

/**
 * Egy szabályos fájl bejegyzés a `buildTestZipArchive` számára, deflate
 * tömörítéssel; a `overrides` bármely fejléc mezőt felülírhat. Kizárólag a
 * `skill-endpoint` téma tesztjei használják.
 */
export function testZipFileEntry(
  name: string,
  content: string | Buffer,
  overrides: Partial<TestZipEntry> = {},
): TestZipEntry {
  const data = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
  return {
    name,
    data,
    compressionMethod: 8,
    versionMadeBy: UNIX_VERSION_MADE_BY,
    externalFileAttributes: REGULAR_FILE_ATTRIBUTES,
    generalPurposeBitFlag: 0,
    declaredUncompressedSize: data.length,
    ...overrides,
  };
}
