/**
 * Egy bájtfolyam beolvasása legfeljebb `maxBytes` bájtig; ha a folyam ennél
 * hosszabb, az eredmény `undefined`, és az olvasás a határ átlépésekor megáll.
 * A korai kilépés a bejárót lezárja (`for await` kilépéskor a bejáró
 * `return()` hívása), ami a web `ReadableStream`-et megszakítja, a fájl
 * folyamot pedig lezárja.
 *
 * Miért kell: a sandbox `fetch` válaszát és a `files.readText` fájlját a gazda
 * a sandboxba másolás előtt a saját memóriájában tartja, és a lépés memória
 * korlátja (`memoryLimitMb`) csak a sandbox memóriájára hat. Korlát nélkül egy
 * végtelen vagy nagy válasz a szerver folyamat memóriáját fogyasztotta el
 * (PLAN-015 T-015-12, research `2026-11-04-szkript-csomopont.md` T-015-12
 * szekció).
 */
export async function readCappedBytes(
  chunks: AsyncIterable<Uint8Array>,
  maxBytes: number,
): Promise<Buffer | undefined> {
  const parts: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of chunks) {
    total += chunk.byteLength;
    if (total > maxBytes) {
      return undefined;
    }
    parts.push(chunk);
  }
  return Buffer.concat(parts);
}
