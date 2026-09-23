import { describe, expect, it } from 'vitest';
import { findRelativeImportSpecifiers } from './find-relative-import-specifiers.ts';
import { findRelativeSpecifierCandidates } from './find-relative-specifier-candidates.ts';

describe('findRelativeSpecifierCandidates', () => {
  it('mindkét idézőjel alakban megtalálja a ./ és a ../ kezdetű specifikátort', () => {
    const sourceText = [
      "import { a } from './a.ts';",
      'export { b } from "../b/b.ts";',
      "import react from 'react';",
    ].join('\n');

    expect(findRelativeSpecifierCandidates(sourceText)).toEqual(['./a.ts', '../b/b.ts']);
  });

  it('egy korábbi, ugyanabban a sorban nyitott hamis jelölt nem takarja el a valódi specifikátort', () => {
    const sourceText = "/* './ */ import { a } from './a.ts';";

    expect(findRelativeSpecifierCandidates(sourceText)).toContain('./a.ts');
  });

  it.each([
    [String.raw`import { a } from '\x2e/a.ts';`],
    [String.raw`import { a } from '.\/a.ts';`],
    [String.raw`import { a } from '..\/a.ts';`],
    [String.raw`import { a } from './a\x42.ts';`],
  ])('visszaperjeles nyers alakra (%s) undefined, mert a feldolgozott érték eltérhet', (sourceText) => {
    expect(findRelativeSpecifierCandidates(sourceText)).toBeUndefined();
  });

  it('sortöréssel megszakított jelöltre undefined', () => {
    expect(findRelativeSpecifierCandidates("import { a } from './a.ts\n';")).toBeUndefined();
    expect(findRelativeSpecifierCandidates("import { a } from './a.ts\r';")).toBeUndefined();
  });

  it('lezáratlan jelöltre undefined', () => {
    expect(findRelativeSpecifierCandidates("import { a } from './a.ts")).toBeUndefined();
  });

  it('relatív jelölt nélküli szövegre üres lista', () => {
    expect(findRelativeSpecifierCandidates("import react from 'react';\nconst dot = '.';")).toEqual([]);
  });

  it('a pontos, parser alapú kinyerés minden eredménye benne van a jelöltek között', () => {
    const sourceText = [
      "import type { A } from './a.ts';",
      "import { b } from '../b.ts';",
      "// megjegyzés: './nem-import.ts'",
      'const text = "idézet: \'./szoveg.ts\'";',
      'export * from "./c.ts";',
      "export { d } from './d.ts';",
    ].join('\n');

    const candidates = findRelativeSpecifierCandidates(sourceText);
    const exact = findRelativeImportSpecifiers('x.ts', sourceText).map(({ specifier }) => specifier);

    expect(exact).toEqual(['./a.ts', '../b.ts', './c.ts', './d.ts']);
    expect(candidates).toEqual(expect.arrayContaining(exact));
  });
});
