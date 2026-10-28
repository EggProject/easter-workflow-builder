import type { SkillUploadErrorClass } from './skill-upload-error-class.ts';

/**
 * A kicsomagolás fájlrendszer hibáinak azon része, amit a feltöltött csomag
 * tartalma okoz (PLAN-012 T-012-27, ZIP 3. találat), a SPEC-009 5.4 tábla
 * osztályára képezve:
 *
 * - `ENAMETOOLONG`: túl hosszú bejegyzés név vagy túl mély útvonal. Az osztálya
 *   nyitott termékdöntés (SPEC-009 14.9 O-50); addig a `skill_archive_unreadable`.
 * - `EEXIST`, `ENOTDIR`, `EISDIR`: két bejegyzés a fájlrendszeren ugyanarra a
 *   helyre esik, de a nevük a saját ütközés ellenőrzésen (`findPathCollision`)
 *   átment, mert a fájlrendszer másként hasonlít össze (például egy, a
 *   `toLowerCase` és az NFC alaktól eltérő kis-nagybetű összevonás).
 *
 * Minden más kód (`ENOSPC`, `EACCES`, `EIO`, ...) a szerver oldali hiba, nem a
 * kliensé: `undefined`, és a hívó továbbdobja a szerver belső hiba útjára.
 */
const CLIENT_CAUSED_CODES: ReadonlyMap<string, SkillUploadErrorClass> = new Map([
  ['ENAMETOOLONG', 'skill_archive_unreadable'],
  ['EEXIST', 'skill_archive_path_collision'],
  ['ENOTDIR', 'skill_archive_path_collision'],
  ['EISDIR', 'skill_archive_path_collision'],
]);

export function classifyFileSystemWriteError(code: string): SkillUploadErrorClass | undefined {
  return CLIENT_CAUSED_CODES.get(code);
}
