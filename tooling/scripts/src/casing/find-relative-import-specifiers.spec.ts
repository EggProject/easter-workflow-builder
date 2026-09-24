import { describe, expect, it } from 'vitest';
import { findRelativeImportSpecifiers } from './find-relative-import-specifiers.ts';

describe('findRelativeImportSpecifiers', () => {
  it('a modul szintű import és export ... from deklaráció relatív specifikátorát a sorszámával adja', () => {
    const sourceText = [
      "import { a } from './a.ts';",
      "import react from 'react';",
      'export { b } from "../b/b.ts";',
      'export { c };',
    ].join('\n');

    expect(findRelativeImportSpecifiers('x.ts', sourceText)).toEqual([
      { specifier: './a.ts', line: 1 },
      { specifier: '../b/b.ts', line: 3 },
    ]);
  });

  it('a string literál argumentumú dinamikus import() hívást a fa bármely mélységében megtalálja', () => {
    const sourceText = [
      "import { it } from 'vitest';",
      "it('belépési pont', async () => {",
      '  await Promise.resolve();',
      "  await import('./Main.tsx');",
      '});',
      'export async function load(): Promise<unknown> {',
      '  return import("../lazy/lazy.ts");',
      '}',
    ].join('\n');

    expect(findRelativeImportSpecifiers('x.ts', sourceText)).toEqual([
      { specifier: './Main.tsx', line: 4 },
      { specifier: '../lazy/lazy.ts', line: 7 },
    ]);
  });

  it('a template literál és a változó argumentumú, valamint a nem relatív dinamikus importot nem adja vissza, mert statikusan nem ellenőrizhető vagy nem relatív', () => {
    const sourceText = [
      'const target = "./valtozo.ts";',
      'await import(target);',
      'await import(`./sablon.ts`);',
      'await import(`./${target}`);',
      "await import('node:fs');",
      'await import();',
    ].join('\n');

    expect(findRelativeImportSpecifiers('x.ts', sourceText)).toEqual([]);
  });

  it('a nem import hívás string literál argumentumát nem veszi dinamikus importnak', () => {
    expect(findRelativeImportSpecifiers('x.ts', "load('./a.ts');\nrequire.resolve('./b.ts');")).toEqual([]);
  });
});
