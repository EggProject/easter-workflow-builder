// Regressziós teszt: minden CSS media query min-width/max-width literálja a
// design-token/breakpoints.css --ep-screen-* tokenjeinek egyikével egyezzen
// meg (SPEC-007 5.3, PLAN-008 T-008-9). A tokenek megvannak
// (design-token/breakpoints.css, M-26), de a media queryket saját kézzel
// kell megírni, mert az M-28 mérés szerint az átemelt forrás egyetlen
// media querye sem érinti a .app-tn bart — ez a teszt őrzi, hogy ahol
// mégis írunk ilyet, ott ne kerüljön be kitalált töréspont.
//
// Megvalósítás fájl nélküli téma (.claude/CLAUDE.md 5. szekció,
// SPEC-002 6.2 5. pont): a kinyerő logika kizárólag ebben a spec fájlban
// áll, mert nem fed le önálló egységet, csak egy konfigurációs invariánst.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Kizárólag a packages/ui és az apps/web forrásfáján álló CSS fájlokat
// nézzük — pontosan azt a két gyökeret, amit a T-008-9 elfogadási
// kritériuma megnevez.
const SOURCE_TREE_CSS_PATTERN = /^(?:packages\/ui|apps\/web)\/src\/.*\.css$/;

const BREAKPOINT_TOKEN_PATTERN = /--ep-screen-[a-z0-9]+:\s*(\d+)px/g;
const MEDIA_QUERY_LITERAL_PATTERN = /(?:min-width|max-width):\s*(\d+)px/g;

interface InvalidBreakpointLiteral {
  readonly file: string;
  readonly pixelValue: number;
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

function readAllowedBreakpointPixelValues(root: string): ReadonlySet<number> {
  const content = readFileSync(path.join(root, 'packages/ui/src/design-token/breakpoints.css'), 'utf8');
  const values = new Set<number>();
  for (const match of content.matchAll(BREAKPOINT_TOKEN_PATTERN)) {
    const rawValue = match[1];
    if (rawValue !== undefined) {
      values.add(Number(rawValue));
    }
  }
  return values;
}

function findInvalidBreakpointLiterals(cssContent: string, allowedPixelValues: ReadonlySet<number>): readonly number[] {
  const invalid: number[] = [];
  for (const match of cssContent.matchAll(MEDIA_QUERY_LITERAL_PATTERN)) {
    const rawValue = match[1];
    if (rawValue === undefined) {
      continue;
    }
    const pixelValue = Number(rawValue);
    if (!allowedPixelValues.has(pixelValue)) {
      invalid.push(pixelValue);
    }
  }
  return invalid;
}

function findInvalidBreakpointLiteralsInTree(
  root: string,
  allowedPixelValues: ReadonlySet<number>,
): readonly InvalidBreakpointLiteral[] {
  const found: InvalidBreakpointLiteral[] = [];
  for (const trackedPath of listTrackedFiles(root)) {
    if (!SOURCE_TREE_CSS_PATTERN.test(trackedPath)) {
      continue;
    }
    const content = readFileSync(path.join(root, trackedPath), 'utf8');
    for (const pixelValue of findInvalidBreakpointLiterals(content, allowedPixelValues)) {
      found.push({ file: trackedPath, pixelValue });
    }
  }
  return found;
}

describe('media query töréspont literál invariáns', () => {
  it('a design-token/breakpoints.css a hét várt --ep-screen-* tokent definiálja', () => {
    const allowed = readAllowedBreakpointPixelValues(repoRoot());
    expect([...allowed].toSorted((a, b) => a - b)).toEqual([640, 768, 1024, 1280, 1536, 1920, 2560]);
  });

  it('a packages/ui/src és az apps/web/src minden CSS fájljának media query literálja token érték', () => {
    const root = repoRoot();
    const allowed = readAllowedBreakpointPixelValues(root);
    expect(findInvalidBreakpointLiteralsInTree(root, allowed)).toEqual([]);
  });

  it('egy kitalált, token-listán kívüli érték megbuktatja a checkert', () => {
    const allowed = readAllowedBreakpointPixelValues(repoRoot());
    const invalidCss = '@media (max-width: 999px) { .x { display: none; } }';
    expect(findInvalidBreakpointLiterals(invalidCss, allowed)).toEqual([999]);
  });

  it('egy valódi, token értékű media query nem bukik el', () => {
    const allowed = readAllowedBreakpointPixelValues(repoRoot());
    const validCss = '@media (max-width: 768px) { .x { display: none; } }';
    expect(findInvalidBreakpointLiterals(validCss, allowed)).toEqual([]);
  });
});
