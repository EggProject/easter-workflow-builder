/**
 * A zip bejegyzés típusa a kicsomagolás szempontjából (SPEC-009 5.4 1. pont).
 */
export type ZipEntryKind = 'file' | 'directory' | 'unsupported';

// APPNOTE 4.4.2: a "version made by" felső bájtja a gazda rendszer; a 3 a Unix.
const UNIX_HOST = 3;
// A Unix `st_mode` fájltípus maszkja és két elfogadott értéke (POSIX `<sys/stat.h>`).
const FILE_TYPE_MASK = 0o17_0000;
const DIRECTORY_TYPE = 0o4_0000;
const REGULAR_FILE_TYPE = 0o10_0000;
// APPNOTE 4.4.15: Unix gazdán a külső attribútum felső 16 bitje a `st_mode`.
const UNIX_MODE_SHIFT = 16;

/**
 * A bejegyzés típusa a metaadatból (SPEC-009 5.4 1. pont). Unix gazdán a
 * külső attribútum felső 16 bitje a Unix mód; ennek fájltípus mezője dönt:
 * könyvtár vagy szabályos fájl fogadható el, minden más (szimbolikus link,
 * eszköz, FIFO, socket) nem. Ha a gazda nem Unix, vagy a típus mező üres, a
 * típust a név adja: a `/` végű név könyvtár (APPNOTE 4.4.17). Ha a Unix típus
 * és a név ellentmond egymásnak, a bejegyzés nem támogatott.
 */
export function resolveZipEntryKind(
  versionMadeBy: number,
  externalFileAttributes: number,
  entryPath: string,
): ZipEntryKind {
  const typeBits =
    versionMadeBy >>> 8 === UNIX_HOST ? (externalFileAttributes >>> UNIX_MODE_SHIFT) & FILE_TYPE_MASK : 0;
  const isNamedAsDirectory = entryPath.endsWith('/');
  if (typeBits === 0) {
    return isNamedAsDirectory ? 'directory' : 'file';
  }
  if (typeBits === DIRECTORY_TYPE && isNamedAsDirectory) {
    return 'directory';
  }
  if (typeBits === REGULAR_FILE_TYPE && !isNamedAsDirectory) {
    return 'file';
  }
  return 'unsupported';
}
