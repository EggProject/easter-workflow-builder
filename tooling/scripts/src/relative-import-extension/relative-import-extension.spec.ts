// Regressziós teszt a SPEC-006 M-5/M-6 mérésre és a PLAN-007 T-007-3 lépésre.
//
// A Node ESM-ben a relatív import kiterjesztése kötelező (M-7,
// https://nodejs.org/api/typescript.html: "file extensions are mandatory in
// `import` statements"). Ennek hiánya a `packages/typeguards/src` alatt tizenkét
// helyen `ERR_MODULE_NOT_FOUND` hibát okozott, amint a `db`, az `engine` és az
// `agent` csomagot Node natív type strippinggel, build lépés nélkül próbáltuk
// betölteni (SPEC-006 2.1 szekció, M-5, M-6) - a `tsc` és a Bun ezt nem jelzi,
// mert egyikük sem az ESM specifikáció szerinti feloldást használja itt.
//
// Ez a teszt megvalósítás nélküli témában áll (`.claude/CLAUDE.md` 5. szekció),
// mert egy már létező, a `casing` témában megírt specifikátor-kinyerő
// függvényt hív újra: nem ír le másodszor TypeScript AST bejárást.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { findRelativeImportSpecifiers } from '../casing/find-relative-import-specifiers.ts';

// Ugyanaz a kiterjesztés lista, mint a `casing` témában: ezekben a
// fájltípusokban fordulhat elő `import`/`export ... from` deklaráció.
const SCANNABLE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

// Csak a `packages/<csomag>/src` és az `apps/<csomag>/src` fa alá eső fájlokat
// nézzük: pontosan azt a két gyökeret, amit a SPEC-006 10.4 megnevez.
const SOURCE_TREE_PATTERN = /^(?:packages|apps)\/[^/]+\/src\//;

// Az M-7 szerint minden relatív specifikátor utolsó szegmensének van
// kiterjesztése: egy pont, amit legalább egy alfanumerikus karakter követ.
const EXTENSION_SUFFIX_PATTERN = /\.[A-Za-z0-9]+$/;

interface ExtensionlessImport {
  readonly file: string;
  readonly line: number;
  readonly specifier: string;
}

function repoRoot(): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- a git a fejlesztoi/CI PATH resze, ugyanugy mint a tobbi wrapper scriptben
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
}

function listTrackedFiles(root: string): readonly string[] {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- a git a fejlesztoi/CI PATH resze, ugyanugy mint a tobbi wrapper scriptben
  const output = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' });
  return output.split('\n').filter((line) => line.length > 0);
}

function isScannableSourceFile(trackedPath: string): boolean {
  return (
    SOURCE_TREE_PATTERN.test(trackedPath) && SCANNABLE_EXTENSIONS.some((extension) => trackedPath.endsWith(extension))
  );
}

function findExtensionlessImports(root: string): readonly ExtensionlessImport[] {
  const found: ExtensionlessImport[] = [];

  for (const trackedPath of listTrackedFiles(root)) {
    if (!isScannableSourceFile(trackedPath)) {
      continue;
    }

    const sourceText = readFileSync(path.join(root, trackedPath), 'utf8');
    for (const { specifier, line } of findRelativeImportSpecifiers(trackedPath, sourceText)) {
      if (!EXTENSION_SUFFIX_PATTERN.test(specifier)) {
        found.push({ file: trackedPath, line, specifier });
      }
    }
  }

  return found;
}

describe('relatív import kiterjesztés a packages/*/src és apps/*/src alatt', () => {
  it('egyetlen relatív import sem áll kiterjesztés nélkül', () => {
    expect(findExtensionlessImports(repoRoot())).toEqual([]);
  });
});
