// Regressziós teszt a csomag határaira: megvalósítás fájl nélküli téma
// (SPEC-002 6.2 5. pont), a kinyerő logika kizárólag ebben a spec fájlban
// áll, mert nem fed le önálló egységet, csak konfigurációs invariánsokat.
//
// Négy invariánst őriz, mind a SPEC-007 16. szekciójából:
//   - 22. kritérium: egyetlen fájlban sincs default `React` import, mert a
//     JSX az automatikus runtime-on megy (M-2, M-3),
//   - 23. kritérium: egyetlen fájl sem importál workspace csomagból, tehát a
//     csomag domain mentes marad (SPEC-007 3.1, PLAN-008 T-008-16),
//   - 24. kritérium: egyetlen fájl sem hivatkozik a `ResizeObserver` és az
//     `IntersectionObserver` API-ra, mert a pinelt happy-dom mindkettőt üres
//     törzsű stubként adja, tehát a rájuk írt teszt hamis zöldet adna
//     (M-24, O-8),
//   - 5. kritérium: a barrel csak nevesített újraexportot tartalmaz, és a
//     placeholder export megszűnt.
//
// Minden szabályhoz tartozik egy szándékosan hibás minta is, ami igazolja,
// hogy a checker ténylegesen ellenőriz, nem mindig zöld.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE_FILE_PATTERN = /^packages\/ui\/src\/.*\.tsx?$/;
// A checker saját fájlja kimarad a vizsgálatból: a tiltott mintákat
// szükségszerűen tartalmazza, hiszen azokat keresi.
const SELF_PATH = 'packages/ui/src/component-boundary-invariant/component-boundary-invariant.spec.ts';

const DEFAULT_REACT_IMPORT_PATTERN = /import\s+React\s*(?:,|from)/;
const WORKSPACE_IMPORT_PATTERN = /from\s+'@easter-workflow-builder\//;
const OBSERVER_PATTERN = /ResizeObserver|IntersectionObserver/;
const EXPORT_STAR_PATTERN = /export\s+\*/;

// A minták a KÓDRA vonatkoznak, nem a kommentekre: a Modal fejléc
// kommentje például szándékosan megnevezi a ResizeObserver tilalmát, a
// barrel fejléce pedig az `export *` tiltását. Ezért minden fájl a
// kommentek eltávolítása után kerül vizsgálat alá.
function stripComments(source: string): string {
  return source.replaceAll(/\/\*[\S\s]*?\*\//g, ' ').replaceAll(/\/\/[^\n]*/g, ' ');
}

function repoRoot(): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- a git a fejlesztoi/CI PATH resze, ugyanugy mint a tobbi wrapper scriptben
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
}

function listSourceFiles(root: string): readonly string[] {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- a git a fejlesztoi/CI PATH resze, ugyanugy mint a tobbi wrapper scriptben
  const output = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' });
  return output
    .split('\n')
    .filter((line) => SOURCE_FILE_PATTERN.test(line))
    .filter((line) => line !== SELF_PATH);
}

function readCodeWithoutComments(root: string, relativePath: string): string {
  const absolutePath = path.join(root, relativePath);
  return stripComments(readFileSync(absolutePath, 'utf8'));
}

function filesMatching(pattern: RegExp): readonly string[] {
  const root = repoRoot();
  return listSourceFiles(root).filter((relativePath) => pattern.test(readCodeWithoutComments(root, relativePath)));
}

describe('a packages/ui komponens határ invariánsai', () => {
  it('a vizsgálat ténylegesen talál fájlokat', () => {
    expect(listSourceFiles(repoRoot()).length).toBeGreaterThan(20);
  });

  it('egyetlen fájlban sincs default React import', () => {
    expect(filesMatching(DEFAULT_REACT_IMPORT_PATTERN)).toEqual([]);
  });

  it('a default React import mintája egy valódi ilyen sorra illeszkedik', () => {
    expect(DEFAULT_REACT_IMPORT_PATTERN.test("import React from 'react';")).toBe(true);
    expect(DEFAULT_REACT_IMPORT_PATTERN.test("import React, { useState } from 'react';")).toBe(true);
    expect(DEFAULT_REACT_IMPORT_PATTERN.test("import { useState } from 'react';")).toBe(false);
  });

  it('egyetlen fájl sem importál workspace csomagból', () => {
    expect(filesMatching(WORKSPACE_IMPORT_PATTERN)).toEqual([]);
  });

  it('a workspace import mintája egy valódi ilyen sorra illeszkedik', () => {
    expect(WORKSPACE_IMPORT_PATTERN.test("import { x } from '@easter-workflow-builder/protocol';")).toBe(true);
    expect(WORKSPACE_IMPORT_PATTERN.test("import { x } from './protocol.ts';")).toBe(false);
  });

  it('a package.json dependencies mezője nem tartalmaz workspace csomagot', () => {
    const manifestPath = path.join(repoRoot(), 'packages/ui/package.json');
    const parsed: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const dependencies =
      typeof parsed === 'object' && parsed !== null && 'dependencies' in parsed ? parsed.dependencies : undefined;
    const names = typeof dependencies === 'object' && dependencies !== null ? Object.keys(dependencies) : [];
    expect(names).toEqual(['@tanstack/react-table', 'react', 'react-dom']);
  });

  it('egyetlen fájl sem hivatkozik ResizeObserver vagy IntersectionObserver API-ra', () => {
    expect(filesMatching(OBSERVER_PATTERN)).toEqual([]);
  });

  it('a komment eltávolító a blokk és a soros kommentet is kiszedi', () => {
    expect(stripComments('const a = 1; // ResizeObserver\nconst b = 2;')).not.toContain('ResizeObserver');
    expect(stripComments('/* export * */ const a = 1;')).not.toContain('export *');
    expect(stripComments('const a = 1;')).toBe('const a = 1;');
  });

  it('a megfigyelő minta egy valódi hivatkozásra illeszkedik', () => {
    expect(OBSERVER_PATTERN.test('new ResizeObserver(() => {})')).toBe(true);
    expect(OBSERVER_PATTERN.test('new IntersectionObserver(() => {})')).toBe(true);
    expect(OBSERVER_PATTERN.test('new MutationObserver(() => {})')).toBe(false);
  });

  it('a barrel csak nevesített újraexportot tartalmaz, placeholder nélkül', () => {
    const barrel = readCodeWithoutComments(repoRoot(), 'packages/ui/src/index.ts');
    expect(EXPORT_STAR_PATTERN.test(barrel)).toBe(false);
    expect(barrel).not.toContain('IS_UI_PLACEHOLDER');
    expect(EXPORT_STAR_PATTERN.test("export * from './button/Button.tsx';")).toBe(true);
  });
});
