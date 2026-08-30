import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// A csomag SRC gyökere (nem csak az event-stream témáé): a hálózat- és
// szám-mentesség csomagszintű garancia (SPEC-005 10.1, 13. szekció 5. és
// 8. kritérium), nem csak az event-stream témáé - ez a fájl azért él itt,
// mert a hálózati primitívek (fetch, EventSource, WebSocket) és a kitalált
// szám kockázata (retry, lapméret) a stream témát érinti leginkább (SPEC-005
// 5.7 "Nem küldünk retry: mezőt", 5.3 "a replayLimit ... nincs kitalált
// szám"), ugyanaz a minta, mint a `packages/db/src/sqlite-connection/barrel-exports.spec.ts`,
// ami a package.json/`src/index.ts` teljes csomagra vonatkozó garanciáját a
// témát ténylegesen hordozó mappában bizonyítja (a tizedik témamappa a
// SPEC-005 13. szekció 1. kritériuma szerint tilos).
const SRC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGE_ROOT = path.join(SRC_DIR, '..');

// Helyi, nem exportált typeguard - a csomag `dependencies` mezője
// szándékosan pontosan `core` és `zod` (SPEC-005 13. szekció 4. kritérium),
// tehát a `@easter-workflow-builder/typeguards` csomag ide nem hozható be
// egyetlen ellenőrző tesztért.
function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

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

describe('a packages/protocol nem nyit hálózatot (SPEC-005 10.1, 13. szekció 5. kritérium)', () => {
  const files = listSourceFiles(SRC_DIR);

  it('talál forrásfájlokat az ellenőrzéshez', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  const forbiddenNetworkPatterns: readonly RegExp[] = [
    /node:http/i,
    /\bfetch\b/i,
    /\bEventSource\b/i,
    /\bWebSocket\b/i,
  ];

  for (const file of files) {
    const relativePath = path.relative(SRC_DIR, file);
    it(`${relativePath}: nincs hálózati primitívre utaló szöveg`, () => {
      const content = readFileSync(file, 'utf8');
      for (const pattern of forbiddenNetworkPatterns) {
        expect(content).not.toMatch(pattern);
      }
    });
  }

  it('a package.json dependencies mezője pontosan a core, a typeguards és a zod csomagot listázza, HTTP könyvtárat nem', () => {
    const packageJsonText = readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8');
    const parsed: unknown = JSON.parse(packageJsonText);
    if (!isObject(parsed) || !('dependencies' in parsed) || !isObject(parsed.dependencies)) {
      throw new Error('a package.json nem tartalmaz objektum dependencies mezőt');
    }
    expect(Object.keys(parsed.dependencies)).toStrictEqual([
      '@easter-workflow-builder/core',
      '@easter-workflow-builder/typeguards',
      'zod',
    ]);
  });
});

describe('a packages/protocol-ban nincs port, időkorlát, lapméret vagy retry szám (SPEC-005 13. szekció 8. kritérium)', () => {
  const files = listSourceFiles(SRC_DIR);

  const forbiddenNumberConceptPatterns: readonly RegExp[] = [
    /\bport\b/i,
    /\btimeout\b/i,
    /\bpage[-_]?size\b/i,
    /\bretry\b/i,
  ];

  for (const file of files) {
    const relativePath = path.relative(SRC_DIR, file);
    it(`${relativePath}: nincs port/időkorlát/lapméret/retry fogalom`, () => {
      const content = readFileSync(file, 'utf8');
      for (const pattern of forbiddenNumberConceptPatterns) {
        expect(content).not.toMatch(pattern);
      }
    });
  }
});
