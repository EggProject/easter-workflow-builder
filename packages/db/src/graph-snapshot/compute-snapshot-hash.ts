import { hash } from 'node:crypto';

/**
 * A kanonikus pillanatkép szöveg `sha256` lenyomata, 64 karakteres kisbetűs
 * hexadecimális szövegként (SPEC-003 5.6, F-21, F-24).
 *
 * A `crypto.hash` egyszeri API a dokumentált gyorsabb út a legfeljebb 5 MB
 * méretű, készen álló adatra (F-22), az `outputEncoding` dokumentált
 * alapértéke `'hex'`, és a string bemenetet az API UTF-8-ként kódolja
 * hashelés előtt, tehát a kanonikus szöveget nem kell külön kódolni (F-21).
 *
 * Az algoritmus elérhetősége nem magától értetődő: a lista a platform OpenSSL
 * verziójától függ (F-23), ezért a `sha256` meglétét külön teszt ellenőrzi a
 * `crypto.getHashes()` kimenetén (SPEC-003 46. kritérium).
 */
export function computeSnapshotHash(canonicalText: string): string {
  return hash('sha256', canonicalText);
}
