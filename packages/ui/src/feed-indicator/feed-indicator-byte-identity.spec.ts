// Bájtszintű regressziós teszt a feed-indicator témára (2026-09-23). A forrás
// skill könyvtár futásidőben nem érhető el, ezért a lenyomat fix literál, a
// forrásból 2026-09-23-án kiszámítva, ugyanaz az indok, mint a resizable
// témában (`resizable-byte-identity.spec.ts`).
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const directory = path.dirname(fileURLToPath(import.meta.url));

/**
 * A forrás `feed-indicator.css` blokkjának SHA-256 lenyomata a saját nyitó
 * kommentjétől a fájl végéig, tehát a két `@import` sor és az utánuk álló
 * üres sor nélkül.
 */
const TRANSPLANTED_BLOCK_SHA256 = '0676d8ba2fe34892db0daaa8eb125a73c21aa3e07b357f40550317b45a0ddcaa';

/**
 * A forrás nyitó kommentjének első két sora. A gondolatjel escape-pel áll,
 * mert a saját forrásfájlban literálként a `no-em-dash` kapu bukna.
 */
const START_MARKER = `/* ${'='.repeat(60)}\n   FeedIndicator \u{2014} live-feed connection state`;

const CSS_COMMENT_PATTERN = /\/\*[\s\S]*?\*\//g;

function findStartIndex(fileContent: string): number {
  const startIndex = fileContent.indexOf(START_MARKER);
  if (startIndex === -1) {
    throw new Error('Az átemelt blokk kezdő jelölője nem található a fájlban.');
  }
  return startIndex;
}

function extractTransplantedBlock(fileContent: string): string {
  return fileContent.slice(findStartIndex(fileContent));
}

/**
 * A kezdő jelölő előtti rész a kommentek nélkül. A lenyomat csak a jelölőtől
 * a fájl végéig tartó blokkot fedi, ezért egy jelölő elé tett szabály,
 * `@import` vagy `@media` a kaszkádban felülírhatná a bájtazonos blokkot
 * úgy, hogy a lenyomat nem változik.
 */
function extractCodeBeforeStartMarker(fileContent: string): string {
  return fileContent.slice(0, findStartIndex(fileContent)).replaceAll(CSS_COMMENT_PATTERN, '');
}

describe('feed-indicator bájtazonosság a forrással', () => {
  it('a feed-indicator.css a fejléc komment után bájtra azonos a forrással', () => {
    const content = readFileSync(path.join(directory, 'feed-indicator.css'), 'utf8');
    const block = extractTransplantedBlock(content);
    expect(createHash('sha256').update(block).digest('hex')).toBe(TRANSPLANTED_BLOCK_SHA256);
  });

  it('a jelölő előtt a fejléc kommenten kívül csak whitespace áll', () => {
    const content = readFileSync(path.join(directory, 'feed-indicator.css'), 'utf8');
    expect(extractCodeBeforeStartMarker(content).trim()).toBe('');
  });
});
