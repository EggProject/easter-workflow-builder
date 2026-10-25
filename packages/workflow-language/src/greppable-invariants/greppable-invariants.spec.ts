// Megvalósítás nélküli, greppel ellenőrizhető invariáns tesztek a `workflow-language`
// csomag határairól (PLAN-010 T-010-11, SPEC-002 6.2 5. pont mintája: konfigurációs
// invariáns saját téma mappában, a mappa neve annak a dolognak a neve, amit őriz). Az
// `apps/web` `greppable-invariants` témájának mintáját követi: a forrásfát nyers
// szövegként olvassa vissza, statikus elemzés nélkül.
//
// Hét invariáns:
//  (1) a `mustache` és a `@marcbachmann/cel-js` csomagot a workspace-ben kizárólag a
//      `packages/workflow-language/src` importálja (SPEC-010 16. szekció 7.);
//  (2) a csomag termékkódjában nincs `node:` import (8.);
//  (3) a csomag termékkódjában nincs `process`, `globalThis`, `require` és `import(`
//      hivatkozás (29.);
//  (4) a termékkód a `mustache` csomagot kizárólag `import Mustache from 'mustache'`
//      alakban importálja, hogy az (5) és (6) minták a könyvtár minden elérését lássák;
//  (5) a `Mustache` azonosító a termékkódban kizárólag a `Mustache.Writer`,
//      `Mustache.Context` és `Mustache.TemplateCache` alakban állhat, tehát a globális
//      `render`, `parse`, `templateCache` és `escape` semmilyen alakban (hívás,
//      értékadás, szögletes zárójel, destrukturálás, álnév) nem érhető el (11., 63.);
//  (6) a `render` név a termékkódban kizárólag metódushívásként (`.render(`), a
//      `MustacheTemplateRenderer` tulajdonságaként vagy metódus definícióként állhat,
//      és a hívás nem ad `partials` (harmadik) argumentumot (30.); a destrukturált,
//      álnéven vagy `call`/`apply`/`bind` útján hívott `render` így bukik;
//  (7) a barrel csak nevesített újraexportot tartalmaz, és a két könyvtárból nem
//      exportál sem típust, sem értéket (3.).
//
// Az (1), (4) ... (6) szándékosan a nyers szövegen dolgozik. Ami ezt megkerüli
// (a modulnév vagy a hívás futásidejű összerakása), szándékos kerülő út, amit a
// szöveg alapú ellenőrzés nem lát; a lint `unicorn/prefer-node-protocol` szabálya
// pedig a `node:` előtagot teszi kötelezővé, ezért a (2) csak azt az alakot keresi.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as celModule from '@marcbachmann/cel-js';
import * as mustacheModule from 'mustache';
import { describe, expect, it } from 'vitest';
import * as barrel from '../index.ts';

const directory = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_SRC = path.join(directory, '..');
const REPO_ROOT = path.join(PACKAGE_SRC, '..', '..', '..');
const BARREL_PATH = path.join(PACKAGE_SRC, 'index.ts');

/**
 * A bejáráskor kihagyott könyvtárak: telepített, generált és gyorsítótár tartalom.
 */
const SKIPPED_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  '.turbo',
  'dist',
  'coverage',
  'coverage-e2e',
  '.nyc_output',
]);
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'] as const;
const WORKSPACE_ROOTS = ['packages', 'apps', 'tooling', 'tools'] as const;

/**
 * Egy `import`, `export ... from`, dinamikus `import()` vagy `require()` modulazonosítója.
 */
const MODULE_SPECIFIER_PREFIX = String.raw`(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s*)`;
const LIBRARY_IMPORT_PATTERN = new RegExp(
  `${MODULE_SPECIFIER_PREFIX}['"](mustache|@marcbachmann/cel-js)(?:/[^'"]*)?['"]`,
  'g',
);
const NODE_IMPORT_PATTERN = new RegExp(`${MODULE_SPECIFIER_PREFIX}['"](node:[^'"]+)['"]`, 'g');
/**
 * A termékkódban egyetlen megengedett `mustache` import alak (4).
 */
const ALLOWED_MUSTACHE_IMPORT = /import\s+Mustache\s+from\s*'mustache'\s*;?/g;
/**
 * A `Mustache` azonosító egyetlen megengedett használata a termékkódban (5): az
 * osztály bázis (`Writer`, `Context`) és a gyorsítótár típusa (`TemplateCache`).
 */
const ALLOWED_MUSTACHE_MEMBER = /^\s*\.\s*(?:Writer|Context|TemplateCache)\b/;

interface SourceFile {
  readonly relativePath: string;
  /**
   * A fájl szövege, a blokk és a teljes soros kommentek nélkül.
   */
  readonly content: string;
}

/**
 * A kommentek kiszűrése, mielőtt egy minta jelenlétét vizsgáljuk: egy magyarázó
 * mondat, ami magát a tiltott hívást idézi, nem termékkód.
 */
function stripComments(content: string): string {
  return content
    .replaceAll(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('//'))
    .join('\n');
}

function listSourceFiles(root: string): readonly SourceFile[] {
  const files: SourceFile[] = [];
  function walk(current: string): void {
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORIES.has(entry.name)) {
          walk(fullPath);
        }
      } else if (SOURCE_EXTENSIONS.some((extension) => entry.name.endsWith(extension))) {
        files.push({
          relativePath: path.relative(REPO_ROOT, fullPath),
          content: stripComments(readFileSync(fullPath, 'utf8')),
        });
      }
    }
  }
  walk(root);
  return files;
}

function isSpecFile(file: SourceFile): boolean {
  return /\.spec\.tsx?$/.test(file.relativePath);
}

function workspaceFiles(): readonly SourceFile[] {
  return WORKSPACE_ROOTS.flatMap((workspaceRoot) => listSourceFiles(path.join(REPO_ROOT, workspaceRoot)));
}

/**
 * A csomag termékkódja: a `src` minden fájlja a teszt fájlok nélkül (SPEC-010 16. szekció 63.).
 */
function productFiles(): readonly SourceFile[] {
  return listSourceFiles(PACKAGE_SRC).filter((file) => !isSpecFile(file));
}

function offendersOf(files: readonly SourceFile[], pattern: RegExp): readonly string[] {
  return files.flatMap((file) =>
    file.content
      .matchAll(pattern)
      .map((match) => `${file.relativePath}: ${match[0].trim()}`)
      .toArray(),
  );
}

/**
 * Az `opening` utáni hívás legfelső szintű argumentumainak száma, a záró zárójelig.
 */
function topLevelArgumentCount(content: string, argumentsStart: number): number {
  let depth = 0;
  let commas = 0;
  let hasContent = false;
  for (const character of content.slice(argumentsStart)) {
    if ('([{'.includes(character)) {
      depth += 1;
    } else if (')]}'.includes(character)) {
      if (depth === 0) {
        break;
      }
      depth -= 1;
    } else if (character === ',' && depth === 0) {
      commas += 1;
      continue;
    }
    hasContent ||= !/\s/.test(character);
  }
  return hasContent ? commas + 1 : 0;
}

describe('a mustache és a cel-js csomagot kizárólag a workflow-language/src importálja (SPEC-010 16. szekció 7.)', () => {
  const allowedRoot = path.join('packages', 'workflow-language', 'src') + path.sep;

  it('a csomag saját forrása importálja őket (a vizsgálat nem üres)', () => {
    const importers = workspaceFiles()
      .filter((file) => offendersOf([file], LIBRARY_IMPORT_PATTERN).length > 0)
      .map((file) => file.relativePath);
    expect(importers).toContain(
      path.join('packages', 'workflow-language', 'src', 'mustache-template', 'strict-writer.ts'),
    );
    expect(importers).toContain(
      path.join('packages', 'workflow-language', 'src', 'cel-expression', 'create-cel-environment.ts'),
    );
  });

  it('a workspace többi fájlja egyiket sem importálja', () => {
    const outside = workspaceFiles().filter((file) => !file.relativePath.startsWith(allowedRoot));
    expect(offendersOf(outside, LIBRARY_IMPORT_PATTERN)).toStrictEqual([]);
  });
});

describe('a csomag termékkódjának határai (SPEC-010 16. szekció 8., 29.)', () => {
  it('a vizsgált termékkód nem üres', () => {
    expect(productFiles().map((file) => file.relativePath)).toContain(
      path.join('packages', 'workflow-language', 'src', 'index.ts'),
    );
  });

  it('nincs node: előtagú import', () => {
    expect(offendersOf(productFiles(), NODE_IMPORT_PATTERN)).toStrictEqual([]);
  });

  it.each([
    ['process', /\bprocess\b/g],
    ['globalThis', /\bglobalThis\b/g],
    ['require', /\brequire\b/g],
    ['import(', /\bimport\s*\(/g],
  ])('nincs %s hivatkozás', (_name, pattern) => {
    expect(offendersOf(productFiles(), pattern)).toStrictEqual([]);
  });
});

describe('a Mustache modul szintű állapotához a csomag nem nyúl (SPEC-010 16. szekció 11., 30., 63.)', () => {
  it('a mustache csomagot kizárólag az import Mustache from alak importálja', () => {
    const remaining = productFiles().map((file) => ({
      ...file,
      content: file.content.replaceAll(ALLOWED_MUSTACHE_IMPORT, ''),
    }));
    expect(offendersOf(remaining, /['"]mustache['"]/g)).toStrictEqual([]);
  });

  it('a Mustache azonosító kizárólag a Writer, Context és TemplateCache tagra mutat', () => {
    const files = productFiles().map((file) => ({
      ...file,
      content: file.content.replaceAll(ALLOWED_MUSTACHE_IMPORT, ''),
    }));
    const usages = files.flatMap((file) =>
      file.content
        .matchAll(/\bMustache\b/g)
        .map((match) => ({
          file: file.relativePath,
          rest: file.content.slice(match.index + match[0].length, match.index + match[0].length + 40),
        }))
        .toArray(),
    );
    expect(usages.length).toBeGreaterThan(0);
    expect(usages.filter((usage) => !ALLOWED_MUSTACHE_MEMBER.test(usage.rest))).toStrictEqual([]);
  });

  it('a render név csak metódushívás, tulajdonság vagy metódus definíció, a hívás partials nélkül', () => {
    const occurrences = productFiles().flatMap((file) =>
      file.content
        .matchAll(/\brender\b/g)
        .map((match) => {
          const before = file.content.slice(0, match.index);
          const after = file.content.slice(match.index + match[0].length);
          const isCall = before.endsWith('.') && after.startsWith('(');
          return {
            file: file.relativePath,
            isCall,
            isAllowed:
              isCall ||
              (/\breadonly\s+$/.test(before) && /^\s*:/.test(after)) ||
              (/(?:^|\n)[ \t]*$/.test(before) && /^\([^)]*\)\s*\{/.test(after)),
            argumentCount: isCall ? topLevelArgumentCount(file.content, match.index + match[0].length + 1) : 0,
          };
        })
        .toArray(),
    );
    expect(occurrences.filter((occurrence) => occurrence.isCall).length).toBeGreaterThan(0);
    expect(occurrences.filter((occurrence) => !occurrence.isAllowed)).toStrictEqual([]);
    expect(occurrences.filter((occurrence) => occurrence.argumentCount > 2)).toStrictEqual([]);
  });
});

describe('a barrel nem szivárogtat a két könyvtárból (SPEC-010 16. szekció 3.)', () => {
  const barrelContent = stripComments(readFileSync(BARREL_PATH, 'utf8'));
  const statements = barrelContent
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement !== '');
  const NAMED_RE_EXPORT = /^export\s+(type\s+)?\{[^}]+\}\s+from\s+'(\.\/[^']+)'$/;

  it('minden utasítás nevesített újraexport relatív útvonalról, export * és import nélkül', () => {
    expect(statements.length).toBeGreaterThan(0);
    expect(statements.filter((statement) => !NAMED_RE_EXPORT.test(statement))).toStrictEqual([]);
  });

  it('a típus újraexportok forrásfájlja egyik könyvtárat sem importálja', () => {
    const typeSources = statements.flatMap((statement) => {
      const match = NAMED_RE_EXPORT.exec(statement);
      return match?.[1] === undefined || match[2] === undefined ? [] : [match[2]];
    });
    expect(typeSources.length).toBeGreaterThan(0);
    const files = typeSources.map((source) => {
      const fullPath = path.join(PACKAGE_SRC, source);
      return {
        relativePath: path.relative(REPO_ROOT, fullPath),
        content: stripComments(readFileSync(fullPath, 'utf8')),
      };
    });
    expect(offendersOf(files, LIBRARY_IMPORT_PATTERN)).toStrictEqual([]);
  });

  it('a barrel egyetlen értéke sem azonos a két könyvtár valamelyik exportjával', () => {
    const libraryValues = new Set<unknown>([
      ...Object.values(celModule),
      ...Object.values(mustacheModule),
      ...Object.values(mustacheModule.default),
    ]);
    const barrelValues = Object.entries(barrel);
    expect(barrelValues.length).toBeGreaterThan(0);
    expect(barrelValues.filter(([, value]) => libraryValues.has(value)).map(([name]) => name)).toStrictEqual([]);
  });
});
