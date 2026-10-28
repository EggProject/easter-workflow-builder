// Bájtszintű regressziós teszt a tag-input témára (2026-10-28). A forrás skill
// könyvtár futásidőben nem érhető el, ezért a lenyomat fix literál, a
// forrásból 2026-10-28-án kiszámítva, ugyanaz az indok, mint a dot témában
// (`dot-byte-identity.spec.ts`).
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const directory = path.dirname(fileURLToPath(import.meta.url));

/**
 * A forrás `tag-input.css` blokkjának SHA-256 lenyomata a saját nyitó
 * kommentjétől a fájl végéig, tehát az `@import` sor és az utána álló üres
 * sor nélkül.
 */
const TRANSPLANTED_BLOCK_SHA256 = 'eff2f4433624e6941abce41ddf27c290afa059c0180611ad0f363661b33e2713';

const START_MARKER = '/* ============ TagInput ============';

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

describe('tag-input bájtazonosság a forrással', () => {
  it('a tag-input.css a fejléc komment után bájtra azonos a forrással', () => {
    const content = readFileSync(path.join(directory, 'tag-input.css'), 'utf8');
    const block = extractTransplantedBlock(content);
    expect(createHash('sha256').update(block).digest('hex')).toBe(TRANSPLANTED_BLOCK_SHA256);
  });

  it('a jelölő előtt a fejléc kommenten kívül csak whitespace áll', () => {
    const content = readFileSync(path.join(directory, 'tag-input.css'), 'utf8');
    expect(extractCodeBeforeStartMarker(content).trim()).toBe('');
  });
});
