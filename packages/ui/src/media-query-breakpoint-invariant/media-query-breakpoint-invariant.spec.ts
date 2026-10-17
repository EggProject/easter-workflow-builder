// Regressziós teszt: minden CSS `@media` és `@container` lekérdezés
// prelúdiumában álló hossz (px, em, rem) a design-token/breakpoints.css
// --ep-screen-* tokenjeinek egyikével egyezzen meg, számra és egységre is
// (SPEC-007 5.3, PLAN-008 T-008-9). A tokenek megvannak
// (design-token/breakpoints.css, M-26), de a media queryket saját kézzel
// kell megírni, mert az M-28 mérés szerint az átemelt forrás egyetlen
// media querye sem érinti a .app-tn bart. Ez a teszt őrzi, hogy ahol
// mégis írunk ilyet, ott ne kerüljön be kitalált töréspont.
//
// A vizsgálat nem a `min-width`/`max-width` kulcsszóra épül, hanem a
// prelúdium minden hossz értékére, így a tartomány szintaxis
// (`width >= 900px`), a tizedes érték (`767.98px`), az `em`/`rem` egység és
// a `@container` lekérdezés is a token kényszer alá esik. A szám nélküli
// lekérdezés (`prefers-*`, `forced-colors`) nem tartalmaz hosszt, tehát
// átmegy. A kommentek a vizsgálat előtt kiesnek: egy magyarázó mondatban
// idézett lekérdezés nem töréspont.
//
// Megvalósítás fájl nélküli téma (.claude/CLAUDE.md 5. szekció,
// SPEC-002 6.2 5. pont): a kinyerő logika kizárólag ebben a spec fájlban
// áll, mert nem fed le önálló egységet, csak egy konfigurációs invariánst.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Kizárólag a packages/ui és az apps/web forrásfáján álló CSS fájlokat
// nézzük: pontosan azt a két gyökeret, amit a T-008-9 elfogadási
// kritériuma megnevez.
const SOURCE_TREE_CSS_PATTERN = /^(?:packages\/ui|apps\/web)\/src\/.*\.css$/;

const CSS_COMMENT_PATTERN = /\/\*[\s\S]*?\*\//g;
// A token értéke szám plusz egység alakban kerül az engedett halmazba, tehát
// egy `em` vagy `rem` lekérdezés csak akkor megy át, ha a token fájl ilyen
// értéket ad.
const BREAKPOINT_TOKEN_PATTERN = /--ep-screen-[a-z0-9]+:\s*(\d+(?:\.\d+)?)(px|em|rem)\b/gi;
// A prelúdium szavakra bontása: minden karakter elválasztó, ami egy CSS
// számban vagy azonosítóban nem állhat, így a `width>=900px` és a
// `min-width:767.98px` is külön szóként adja a hosszt.
const PRELUDE_WORD_SEPARATOR_PATTERN = /[^\w.+-]+/;
// Egy teljes szó, ami CSS szám (előjel, tizedes rész, exponens) és
// közvetlenül utána px, em vagy rem egység. Horgonyzott, tehát egy szón
// belül nem keres újra minden pozíciótól.
const LENGTH_WORD_PATTERN = /^([+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?)(px|em|rem)$/i;
// Csak az `@media` és az `@container` előírás fejlécét (a kulcsszó és a
// nyitó "{" közötti feltétel-listát) nézzük: a `.toast-viewport {
// max-width: 380px; }`-hoz hasonló, sima komponens-méretezési tulajdonság
// nem töréspont, tehát nem tartozik a token-kényszer alá.
const QUERY_PRELUDE_PATTERN = /@(?:media|container)\b([^{]*)\{/gi;

interface InvalidBreakpointLiteral {
  readonly file: string;
  readonly length: string;
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

/**
 * Egy hossz összehasonlítható alakja: a szám értéke és a kisbetűs egység,
 * így a `768px`, a `768.0px` és a `768PX` azonos, a `767.98px` nem.
 */
function normalizeLength(rawNumber: string, unit: string): string {
  return `${String(Number(rawNumber))}${unit.toLowerCase()}`;
}

function readAllowedBreakpointLengths(root: string): ReadonlySet<string> {
  const content = readFileSync(path.join(root, 'packages/ui/src/design-token/breakpoints.css'), 'utf8');
  const values = new Set<string>();
  for (const match of content.matchAll(BREAKPOINT_TOKEN_PATTERN)) {
    const [, rawNumber, unit] = match;
    if (rawNumber !== undefined && unit !== undefined) {
      values.add(normalizeLength(rawNumber, unit));
    }
  }
  return values;
}

function collectInvalidLengthsFromPrelude(prelude: string, allowedLengths: ReadonlySet<string>): readonly string[] {
  const invalid: string[] = [];
  for (const word of prelude.split(PRELUDE_WORD_SEPARATOR_PATTERN)) {
    const [, rawNumber, unit] = LENGTH_WORD_PATTERN.exec(word) ?? [];
    if (rawNumber === undefined || unit === undefined) {
      continue;
    }
    const length = normalizeLength(rawNumber, unit);
    if (!allowedLengths.has(length)) {
      invalid.push(length);
    }
  }
  return invalid;
}

function findInvalidBreakpointLiterals(cssContent: string, allowedLengths: ReadonlySet<string>): readonly string[] {
  const invalid: string[] = [];
  const withoutComments = cssContent.replaceAll(CSS_COMMENT_PATTERN, ' ');
  for (const preludeMatch of withoutComments.matchAll(QUERY_PRELUDE_PATTERN)) {
    const prelude = preludeMatch[1];
    if (prelude === undefined) {
      continue;
    }
    invalid.push(...collectInvalidLengthsFromPrelude(prelude, allowedLengths));
  }
  return invalid;
}

function findInvalidBreakpointLiteralsInTree(
  root: string,
  allowedLengths: ReadonlySet<string>,
): readonly InvalidBreakpointLiteral[] {
  const found: InvalidBreakpointLiteral[] = [];
  for (const trackedPath of listTrackedFiles(root)) {
    if (!SOURCE_TREE_CSS_PATTERN.test(trackedPath)) {
      continue;
    }
    const content = readFileSync(path.join(root, trackedPath), 'utf8');
    for (const length of findInvalidBreakpointLiterals(content, allowedLengths)) {
      found.push({ file: trackedPath, length });
    }
  }
  return found;
}

describe('media query töréspont literál invariáns', () => {
  it('a design-token/breakpoints.css a hét várt --ep-screen-* tokent definiálja', () => {
    const allowed = readAllowedBreakpointLengths(repoRoot());
    expect(allowed).toEqual(new Set(['640px', '768px', '1024px', '1280px', '1536px', '1920px', '2560px']));
  });

  it('a packages/ui/src és az apps/web/src minden CSS fájljának lekérdezés hossza token érték', () => {
    const root = repoRoot();
    const allowed = readAllowedBreakpointLengths(root);
    expect(findInvalidBreakpointLiteralsInTree(root, allowed)).toEqual([]);
  });

  it('egy kitalált, token-listán kívüli érték megbuktatja a checkert', () => {
    const allowed = readAllowedBreakpointLengths(repoRoot());
    const invalidCss = '@media (max-width: 999px) { .x { display: none; } }';
    expect(findInvalidBreakpointLiterals(invalidCss, allowed)).toEqual(['999px']);
  });

  it.each([
    ['tartomány szintaxis', '@media (width >= 900px) { .x { display: none; } }', ['900px']],
    ['tizedes px', '@media (max-width: 767.98px) { .x { display: none; } }', ['767.98px']],
    ['em egység', '@media (min-width: 48em) { .x { display: none; } }', ['48em']],
    ['rem egység', '@media (min-width: 64rem) { .x { display: none; } }', ['64rem']],
    ['container lekérdezés', '@container card (min-width: 400px) { .x { display: none; } }', ['400px']],
    ['beágyazott media', '.x { @media (min-width: 700px) { display: none; } }', ['700px']],
  ])('a %s alakú kitalált érték is megbuktatja a checkert', (_label, css, expected) => {
    const allowed = readAllowedBreakpointLengths(repoRoot());
    expect(findInvalidBreakpointLiterals(css, allowed)).toEqual(expected);
  });

  it('egy valódi, token értékű media query nem bukik el, tartomány szintaxissal sem', () => {
    const allowed = readAllowedBreakpointLengths(repoRoot());
    const validCss = '@media (max-width: 768px) { .x { display: none; } } @media (640px <= width < 1024px) { .y {} }';
    expect(findInvalidBreakpointLiterals(validCss, allowed)).toEqual([]);
  });

  it('a szám nélküli lekérdezés és a kommentben idézett lekérdezés nem bukik el', () => {
    const allowed = readAllowedBreakpointLengths(repoRoot());
    const validCss = [
      '@media (prefers-reduced-motion: reduce) { .x { transition: none; } }',
      '@media (forced-colors: active) { .x { border: 1px solid; } }',
      '/* @media (max-width: 999px) csak idézet */ .y { max-width: 380px; }',
    ].join('\n');
    expect(findInvalidBreakpointLiterals(validCss, allowed)).toEqual([]);
  });
});
