// APPNOTE 4.3.16: a záró rekord aláírása és rögzített hossza (megjegyzés nélkül).
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
const END_OF_CENTRAL_DIRECTORY_SIZE = 22;
const CENTRAL_DIRECTORY_SIZE_OFFSET = 12;
// APPNOTE 4.3.15: a ZIP64 záró rekord helymutatója közvetlenül a záró rekord előtt áll, 20 bájt.
const ZIP64_LOCATOR_SIGNATURE = 0x07_06_4b_50;
const ZIP64_LOCATOR_SIZE = 20;
const ZIP64_RECORD_OFFSET_IN_LOCATOR = 8;
// APPNOTE 4.3.14: a ZIP64 záró rekordban a központi könyvtár mérete a 40. bájttól, 8 bájton.
const ZIP64_CENTRAL_DIRECTORY_SIZE_OFFSET = 40;

/**
 * A záró rekordban deklarált központi könyvtár méret bájtban (PLAN-012
 * T-012-27, ZIP 6. találat). A `yauzl` 3.4.0 a központi könyvtárból pontosan a
 * záró rekord bejegyzésszámát olvassa (`index.js` `_readEntry`: a
 * `entryCount === entriesRead` feltételnél megáll), a deklarált méretet nem
 * tárolja és nem ellenőrzi, ezért egy alulhazudott bejegyzésszámnál a további
 * bejegyzések csendben kimaradnának. A záró rekordot ugyanúgy keresi, mint a
 * `yauzl`: a legutolsó aláírás a fájl utolsó 22 bájtja előtt, és ha előtte
 * ZIP64 helymutató áll, a ZIP64 záró rekord mezője érvényes. A hívó csak a
 * `yauzl` által már sikeresen megnyitott csomagra hívja, tehát a záró rekord
 * (és ZIP64 esetén a rekord) létezik.
 */
export function readDeclaredCentralDirectorySize(archive: Buffer): number {
  const end = archive.lastIndexOf(END_OF_CENTRAL_DIRECTORY_SIGNATURE, archive.length - END_OF_CENTRAL_DIRECTORY_SIZE);
  const locator = end - ZIP64_LOCATOR_SIZE;
  if (locator >= 0 && archive.readUInt32LE(locator) === ZIP64_LOCATOR_SIGNATURE) {
    const record = Number(archive.readBigUInt64LE(locator + ZIP64_RECORD_OFFSET_IN_LOCATOR));
    return Number(archive.readBigUInt64LE(record + ZIP64_CENTRAL_DIRECTORY_SIZE_OFFSET));
  }
  return archive.readUInt32LE(end + CENTRAL_DIRECTORY_SIZE_OFFSET);
}
