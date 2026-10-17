// Bájtszintű regressziós teszt a button-group témára (2026-10-18, SPEC-008
// 66. kritérium, PLAN-009 T-009-35). A forrás skill könyvtár futásidőben nem
// érhető el, ezért a lenyomat fix literál, a forrás
// `eggproject-design-components/components/button-group/button-group.css`
// fájljából 2026-10-18-án kiszámítva, ugyanaz az indok, mint a drawer és a
// resizable témában (`drawer-byte-identity.spec.ts`). A fájl a forrás blokkja
// után egy dokumentált kiegészítést hordoz (a `Menu` trigger `.menu-anchor`
// csomagolója), ez a lenyomaton kívül esik, a helyét a harmadik teszt őrzi.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const directory = path.dirname(fileURLToPath(import.meta.url));

/**
 * A forrás `button-group.css` blokkjának SHA-256 lenyomata a saját nyitó
 * kommentjétől a fájl végéig, tehát az `@import` sor és az utána álló üres
 * sor nélkül.
 */
const TRANSPLANTED_BLOCK_SHA256 = 'a1a82d568e891697ba78f13f66b926689dff7943c9f7d53a511bca805fbf0a7e';

/**
 * A forrás nyitó kommentjének első sora.
 */
const START_MARKER = '/* ============ Button Group ============';

/**
 * A dokumentált kiegészítés nyitó kommentjének első sora; előtte egy üres sor
 * választja el a forrás blokkjától.
 */
const ADDITION_MARKER = '\n/* ============ Egyedi kiegészítés: Menu trigger a csoportban ============';

const CSS_COMMENT_PATTERN = /\/\*[\s\S]*?\*\//g;

function readButtonGroupCss(): string {
  return readFileSync(path.join(directory, 'button-group.css'), 'utf8');
}

function findIndex(fileContent: string, marker: string): number {
  const index = fileContent.indexOf(marker);
  if (index === -1) {
    throw new Error(`A jelölő nem található a fájlban: ${marker}`);
  }
  return index;
}

describe('button-group bájtazonosság a forrással', () => {
  it('a button-group.css forrásból átemelt blokkja bájtra azonos a forrással (AC66)', () => {
    const content = readButtonGroupCss();
    const block = content.slice(findIndex(content, START_MARKER), findIndex(content, ADDITION_MARKER));
    expect(createHash('sha256').update(block).digest('hex')).toBe(TRANSPLANTED_BLOCK_SHA256);
  });

  it('a jelölő előtt a fejléc kommenten kívül csak whitespace áll', () => {
    const content = readButtonGroupCss();
    expect(content.slice(0, findIndex(content, START_MARKER)).replaceAll(CSS_COMMENT_PATTERN, '').trim()).toBe('');
  });

  it('a forrás blokkja után kizárólag a dokumentált kiegészítés áll, utána pedig nincs újabb blokk', () => {
    const content = readButtonGroupCss();
    const addition = content.slice(findIndex(content, ADDITION_MARKER));
    expect(addition.startsWith(ADDITION_MARKER)).toBe(true);
    expect(addition.slice(ADDITION_MARKER.length).includes('/* ============')).toBe(false);
  });
});
