import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Megvalósítás nélküli, greppel ellenőrizhető regressziós teszt (T-009-33
// (13), SPEC-008 15. szekció 58. kritérium, SPEC-005 7.3, 7.4): a
// `node-config` téma tíz ágú `NodeConfig` uniója és a duplikált
// provider-capability felsorolásai (SPEC-005 7.7 kivétele) is a csomag négy
// séma írási szabálya alatt állnak. A `packages/protocol` egészére már fut a
// `protocol-error` téma `wire-validation-discipline.spec.ts` csomagszintű
// ellenőrzése (SPEC-005 13. szekció 32. és 14. kritérium); ez a teszt
// ugyanazt a két mintát nézi, de kifejezetten a `node-config` témára
// szűkítve, mert ez a mappa a SPEC-008-ban külön, kimondott kötelezettség
// (58. kritérium), amit a PLAN-009 T-009-33 saját, névvel azonosítható
// tételként sorol fel - ha ez a mappa valaha kikerülne a csomagszintű
// ellenőrzés hatóköréből, ez a teszt akkor is megfogja.
const directory = path.dirname(fileURLToPath(import.meta.url));

function listNodeConfigSourceFiles(): readonly string[] {
  const entries = readdirSync(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts'))
    .map((entry) => entry.name);
}

describe('a node-config séma sem .parse(-t, sem .default(-t, sem .transform(-t nem hív (SPEC-008 58. kritérium, T-009-33 (13))', () => {
  const files = listNodeConfigSourceFiles();

  it('talál forrásfájlokat az ellenőrzéshez', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  const forbiddenCallPatterns: readonly string[] = ['.parse(', '.default(', '.transform('];

  for (const fileName of files) {
    it(`${fileName}: nincs .parse(, .default( vagy .transform( hívás`, () => {
      const content = readFileSync(path.join(directory, fileName), 'utf8');
      for (const forbiddenCall of forbiddenCallPatterns) {
        // Case-sensitive: a `.safeParse(` "Parse" nagy P-vel áll, tehát a kis
        // "p"-s ".parse(" mintát ez a keresés nem találja meg abban.
        expect(content).not.toContain(forbiddenCall);
      }
    });
  }
});
