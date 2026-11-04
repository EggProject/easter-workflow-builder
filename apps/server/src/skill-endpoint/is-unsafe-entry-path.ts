import path from 'node:path';

const DRIVE_LETTER_PREFIX = /^[A-Za-z]:/u;
const FORBIDDEN_SEGMENTS: ReadonlySet<string> = new Set(['', '.', '..']);

/**
 * A feloldott cél a cél könyvtáron belül marad-e (SPEC-009 5.4 2. pont,
 * második védvonal a névszabály mellett).
 */
function isInsideDirectory(candidate: string, directory: string): boolean {
  const relative = path.relative(directory, candidate);
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

/**
 * Tiltott-e a bejegyzés útvonala (SPEC-009 5.4 2. pont): abszolút (`/` vagy
 * meghajtó jel kezdet), `..` szegmens, visszaper és NUL bájt. Az üres és a
 * `.` szegmens is tiltott, mert ugyanarra a helyre több név mutatna, és az
 * ütközés ellenőrzés (3. pont) a nevek kanonikus alakjára épül. A `yauzl`
 * beépített `validateFileName` ellenőrzése nem váltja ki ezt (a
 * kicsomagoló `decodeStrings: false` mellett maga dekódolja a nevet).
 */
export function isUnsafeEntryPath(entryPath: string, targetDirectory: string): boolean {
  const trimmed = entryPath.endsWith('/') ? entryPath.slice(0, -1) : entryPath;
  return (
    entryPath.startsWith('/') ||
    DRIVE_LETTER_PREFIX.test(entryPath) ||
    entryPath.includes('\\') ||
    entryPath.includes('\0') ||
    trimmed.split('/').some((segment) => FORBIDDEN_SEGMENTS.has(segment)) ||
    !isInsideDirectory(path.resolve(targetDirectory, trimmed), targetDirectory)
  );
}
