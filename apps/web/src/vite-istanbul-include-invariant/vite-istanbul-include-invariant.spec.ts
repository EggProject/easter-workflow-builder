// Regressziós teszt, megvalósítás fájl nélkül (SPEC-002 6.2 5. pont): a
// `vite.config.ts` `vite-plugin-istanbul` `include` mintázata a teljes
// forrásfát fedje (`src/**/*`), ne csak a `src/` közvetlen fájljait
// (`src/*`), különben a téma mappák alá süllyesztett komponensek
// instrumentálatlanok maradnának az e2e lefedettségben (T-008-18).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const directory = path.dirname(fileURLToPath(import.meta.url));

describe('vite-plugin-istanbul include mintázat invariáns', () => {
  it('a vite.config.ts include mintázata "src/**/*", nem "src/*"', () => {
    const content = readFileSync(path.join(directory, '..', '..', 'vite.config.ts'), 'utf8');
    expect(content).toContain("include: 'src/**/*'");
    expect(content).not.toContain("include: 'src/*'");
  });
});
