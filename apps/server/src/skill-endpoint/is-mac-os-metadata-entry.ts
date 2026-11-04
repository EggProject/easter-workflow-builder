/**
 * A macOS Finder "Tömörítés" parancsa a csomag gyökerében egy `__MACOSX/` könyvtárat is létrehoz a
 * fájlok kiterjesztett attribútumaival (AppleDouble `._<név>` fájlok); ezek nem a skill részei. A
 * kicsomagolás az első útvonal tagjával pontosan `__MACOSX` nevű bejegyzést kihagyja (SPEC-009 5.4,
 * O-57, user döntés 2026-10-28).
 */
export function isMacOsMetadataEntry(entryPath: string): boolean {
  return entryPath.split('/', 1)[0] === '__MACOSX';
}
