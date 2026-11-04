/**
 * A ZIP feltöltés három korlátja (SPEC-009 5.4 6. pont, O-34). Az alapértékük
 * és az env változójuk a `server-config` témában áll; ez a típus a
 * kicsomagoló és a feltöltés kezelő közös bemenete.
 */
export interface SkillArchiveLimits {
  // A feltöltött törzs (a zip) legnagyobb mérete bájtban.
  readonly maxArchiveBytes: number;
  // A kicsomagolt fájlok összméretének felső korlátja, a ténylegesen kiírt bájtokon számolva.
  readonly maxUnpackedBytes: number;
  // A bejegyzések (fájl és könyvtár együtt) legnagyobb száma.
  readonly maxEntryCount: number;
}
