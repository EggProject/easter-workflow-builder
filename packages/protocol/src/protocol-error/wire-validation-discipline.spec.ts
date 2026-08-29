import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// A csomag SRC gyökere (nem csak a protocol-error témáé): a séma írás négy
// szabálya (SPEC-005 7.3) és a titok kiszivárgás tilalma (8.4) csomagszintű
// garancia (13. szekció 4., 5., 8., 16. kritérium), nem csak a
// protocol-error témáé - ez a fájl azért él itt, mert a `.safeParse()`
// kizárólagossága és a `.default()`/`.transform()` tilalom a Zod hiba
// fordítás témájához (`zod-error-to-protocol-error-body.ts`) és a titok
// kiszivárgás tilalma a hiba boríték alakjához (8.1, 8.4) kötődik a
// legszorosabban, ugyanaz a minta, mint a
// `packages/db/src/sqlite-connection/barrel-exports.spec.ts` (a tizedik
// témamappa a SPEC-005 13. szekció 1. kritériuma szerint tilos).
const SRC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function listSourceFiles(directory: string): readonly string[] {
  const entries = readdirSync(directory);
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...listSourceFiles(fullPath));
      continue;
    }
    if (entry.endsWith('.ts') && !entry.endsWith('.spec.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('a packages/protocol-ban nincs Authorization fejléc, süti vagy token mező (SPEC-005 13. szekció 7. kritérium)', () => {
  const files = listSourceFiles(SRC_DIR);

  it('talál forrásfájlokat az ellenőrzéshez', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  const forbiddenSecretPatterns: readonly RegExp[] = [/Authorization/i, /\bcookie\b/i, /\btoken\b/i];

  for (const file of files) {
    const relativePath = path.relative(SRC_DIR, file);
    it(`${relativePath}: nincs Authorization/cookie/token szöveg`, () => {
      const content = readFileSync(file, 'utf8');
      for (const pattern of forbiddenSecretPatterns) {
        expect(content).not.toMatch(pattern);
      }
    });
  }
});

describe('a packages/protocol kizárólag .safeParse(-t hív, .parse(-t soha (SPEC-005 7.4, 13. szekció 20. kritérium)', () => {
  const files = listSourceFiles(SRC_DIR);

  for (const file of files) {
    const relativePath = path.relative(SRC_DIR, file);
    it(`${relativePath}: nincs .parse( hívás`, () => {
      const content = readFileSync(file, 'utf8');
      // Case-sensitive: a `.safeParse(` szövegben a "Parse" nagy P-vel áll,
      // tehát a kis "p"-s ".parse(" mintát ez a keresés nem találja meg a
      // ".safeParse(" hívásokban - direkt emiatt NEM `/i` jelzős a minta.
      expect(content).not.toContain('.parse(');
    });
  }
});

describe('a packages/protocol egyetlen sémájában sincs .default() vagy .transform() (SPEC-005 7.3 2. szabály, 13. szekció 21. kritérium)', () => {
  const files = listSourceFiles(SRC_DIR);

  const forbiddenSchemaMethods: readonly string[] = ['.default(', '.transform('];

  for (const file of files) {
    const relativePath = path.relative(SRC_DIR, file);
    it(`${relativePath}: nincs .default( vagy .transform( hívás`, () => {
      const content = readFileSync(file, 'utf8');
      for (const forbiddenMethod of forbiddenSchemaMethods) {
        expect(content).not.toContain(forbiddenMethod);
      }
    });
  }
});
