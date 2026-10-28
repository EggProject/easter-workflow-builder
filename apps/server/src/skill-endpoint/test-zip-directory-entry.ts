import type { TestZipEntry } from './build-test-zip-archive.ts';

const UNIX_VERSION_MADE_BY = 0x3_14;
// Könyvtár, 0755 jogosultsággal, a felső 16 biten; az alsó bájt MS-DOS könyvtár bitje (0x10).
const DIRECTORY_ATTRIBUTES = 0o4_0755 * 0x1_00_00 + 0x10;

/**
 * Egy könyvtár bejegyzés (a név `/` végű) a `buildTestZipArchive` számára.
 * Kizárólag a `skill-endpoint` téma tesztjei használják.
 */
export function testZipDirectoryEntry(name: string): TestZipEntry {
  return {
    name,
    data: Buffer.alloc(0),
    compressionMethod: 0,
    versionMadeBy: UNIX_VERSION_MADE_BY,
    externalFileAttributes: DIRECTORY_ATTRIBUTES,
    generalPurposeBitFlag: 0,
    declaredUncompressedSize: 0,
  };
}
