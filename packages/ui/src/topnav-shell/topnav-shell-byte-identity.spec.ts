// Bajtszintu regresszios teszt a topnav-shell temara (SPEC-007 4.2, 5.2).
// Ket dolgot igazol: (1) az atemelt .app-pagehead / .app-content / .app-tn
// szabalyok bajtra azonosak a forrassal (a forras skill konyvtar futasidoben
// nem erheto el, ezert a lenyomat fix literal, a forrasbol 2026-09-01-en
// kiszamitva - ugyanaz az indok, mint a design-token temaban); (2) a "faltol
// falig" override valoban a --ep-layout-max-full sentinelre allitja a
// --ep-layout-app-max tokent, es ez a lanc a --ep-layout-max-full: none
// erteken at "none" max-width-re oldodik fel.
//
// A lanc feloldasat NEM a getComputedStyle adja: SAJAT MERES igazolja
// (2026-09-01), hogy a pinelt happy-dom@20.11.6 getComputedStyle-ja a
// var(...) hivatkozast nem oldja fel (a MaxWidth stringje valtozatlanul
// "var(--ep-layout-max-full)" marad), tehat egy DOM alapu computed-style
// assertion hamis biztonsagot adna. A teszt ezert magat a CSS szoveget
// elemzi, es a var() lancot maga oldja fel, ugyanazzal a szaballyal, amit a
// CSS kaszkad kovetne: a kesobb deklaralt, szukebb scope-ban (.app-tn) allo
// custom property ertek felulirja a korabbi/tagabb ertekeket.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const directory = path.dirname(fileURLToPath(import.meta.url));

/**
 * Az atemelt blokk (a forras _shell.css 260-331. sora) SHA-256 lenyomata.
 */
const TRANSPLANTED_BLOCK_SHA256 = '62cb537385b94f0f199c3c9bb218f3e6a59adc150cec3b0e720cc0433b12ae84';

const START_MARKER = '/* === Page header inside main ============================== */';
const END_MARKER_LINE = '.app-tn__inner { width: 100%; max-width: var(--ep-layout-max-app, 1240px); margin: 0 auto; }';

function extractTransplantedBlock(fileContent: string): string {
  const startIndex = fileContent.indexOf(START_MARKER);
  const endLineIndex = fileContent.indexOf(END_MARKER_LINE);
  if (startIndex === -1 || endLineIndex === -1) {
    throw new Error('Az atemelt blokk hatarjelei nem talalhatok a fajlban.');
  }
  return fileContent.slice(startIndex, endLineIndex + END_MARKER_LINE.length);
}

/**
 * Egy custom property teljes var() lancanak feloldasa (nem csak egy
 * fokozat): amig az ertek var(--x) alaku, tovabb keresi --x deklaraciojat,
 * ciklusban, rekurzio nelkul.
 */
function resolveCustomProperty(propertyName: string, declarationBlocks: readonly string[]): string {
  let currentPropertyName = propertyName;

  for (;;) {
    let value: string | undefined;
    for (const block of declarationBlocks) {
      const pattern = new RegExp(String.raw`${currentPropertyName}:\s*([^;]+);`);
      const match = pattern.exec(block);
      if (match?.[1] !== undefined) {
        value = match[1].trim();
      }
    }
    if (value === undefined) {
      throw new Error(`Nincs deklaracio a ${currentPropertyName} tulajdonsagra.`);
    }
    const variableMatch = /^var\((--[a-z0-9-]+)\)$/.exec(value);
    if (variableMatch?.[1] === undefined) {
      return value;
    }
    currentPropertyName = variableMatch[1];
  }
}

describe('topnav-shell bajtazonossag a forrassal', () => {
  it('az atemelt .app-pagehead / .app-content / .app-tn blokk bajtra azonos a forrassal', () => {
    const content = readFileSync(path.join(directory, 'topnav-shell.css'), 'utf8');
    const block = extractTransplantedBlock(content);
    expect(createHash('sha256').update(block).digest('hex')).toBe(TRANSPLANTED_BLOCK_SHA256);
  });

  it('a faltol falig override UJ, onallo blokkban all, az atemelt .app-tn szabaly utan', () => {
    const content = readFileSync(path.join(directory, 'topnav-shell.css'), 'utf8');
    const block = extractTransplantedBlock(content);
    const afterBlockIndex = content.indexOf(block) + block.length;
    const rest = content.slice(afterBlockIndex);

    expect(rest).toContain('.app-tn {\n  --ep-layout-max-app: var(--ep-layout-max-full);\n}');
    // Az atemelt .app-tn szabaly (a blokkon belul) NEM tartalmazza a
    // --ep-layout-max-app felulirast - az kizarolag az uj blokkban all.
    const transplantedAppTnRule = /\.app-tn \{[^}]*\}/.exec(block)?.[0];
    expect(transplantedAppTnRule).toBeDefined();
    expect(transplantedAppTnRule).not.toContain('--ep-layout-max-app');
  });

  it('a --ep-layout-max-app lanc a .app-tn scope-jaban "none" ertekre oldodik fel', () => {
    const breakpoints = readFileSync(path.join(directory, '..', 'design-token', 'breakpoints.css'), 'utf8');
    const shell = readFileSync(path.join(directory, 'topnav-shell.css'), 'utf8');

    expect(breakpoints).toContain('--ep-layout-max-full:   none;');

    const resolved = resolveCustomProperty('--ep-layout-max-app', [breakpoints, shell]);
    expect(resolved).toBe('none');
  });

  it('az .app-tn__inner max-width deklaracioja valtozatlan (var(--ep-layout-max-app, 1240px))', () => {
    const content = readFileSync(path.join(directory, 'topnav-shell.css'), 'utf8');
    expect(content).toContain(END_MARKER_LINE);
  });
});
