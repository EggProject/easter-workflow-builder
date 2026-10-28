import type { SkillUploadErrorClass } from './skill-upload-error-class.ts';

/**
 * A `yauzl` 3.4.0 méret ellenőrzésének hibaszövegei (`index.js`: a tárolt
 * bejegyzés fejlécének eltérése a központi könyvtár olvasásakor, és az
 * `AssertByteCountStream` két ága kicsomagolás közben; README
 * `validateEntrySizes`). A verzió pontosan pinelt, frissítéskor a
 * `extract-skill-archive.spec.ts` méret eltérés tesztjei bukással jeleznék a
 * szöveg változását.
 */
const SIZE_MISMATCH_MARKERS = [
  'compressed/uncompressed size mismatch',
  'too many bytes in the stream',
  'not enough bytes in the stream',
] as const;

// A `yauzl` az erős titkosítás jelzőjét (0x40) már a bejegyzés kiadása előtt elutasítja.
const STRONG_ENCRYPTION_MARKER = 'strong encryption is not supported';

/**
 * A `yauzl` olvasási hibájának besorolása a SPEC-009 5.4 tábla osztályaira: a
 * deklarált és tényleges méret eltérése, az erős titkosítás, és minden más
 * olvasási hiba (sérült fejléc, tömörítési hiba) a "nem olvasható csomag".
 */
export function classifyZipReadError(error: unknown): SkillUploadErrorClass {
  const text = String(error);
  if (SIZE_MISMATCH_MARKERS.some((marker) => text.includes(marker))) {
    return 'skill_archive_entry_size_mismatch';
  }
  if (text.includes(STRONG_ENCRYPTION_MARKER)) {
    return 'skill_archive_entry_encrypted';
  }
  return 'skill_archive_unreadable';
}
