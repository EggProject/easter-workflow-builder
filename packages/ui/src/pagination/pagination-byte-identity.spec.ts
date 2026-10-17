// Bájtszintű regressziós teszt a pagination témára (2026-09-25). A forrás
// skill könyvtár futásidőben nem érhető el, ezért a lenyomat fix literál, a
// forrásból 2026-09-25-én kiszámítva, ugyanaz az indok, mint a resizable
// témában (`resizable-byte-identity.spec.ts`).
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const directory = path.dirname(fileURLToPath(import.meta.url));

/**
 * A forrás `pagination.css` blokkjának SHA-256 lenyomata a saját nyitó
 * kommentjétől a fájl végéig, tehát az `@import` sor és az utána álló üres
 * sor nélkül.
 */
const TRANSPLANTED_BLOCK_SHA256 = '191fa57a64d0cf20a746143040a35ed56ef17aebf69a4e8af0e5bbaf1aa3b25f';

/**
 * A forrás nyitó kommentjének első sora.
 */
const START_MARKER = '/* ============ Pagination ============';

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

describe('pagination bájtazonosság a forrással', () => {
  it('a pagination.css a fejléc komment után bájtra azonos a forrással', () => {
    const content = readFileSync(path.join(directory, 'pagination.css'), 'utf8');
    const block = extractTransplantedBlock(content);
    expect(createHash('sha256').update(block).digest('hex')).toBe(TRANSPLANTED_BLOCK_SHA256);
  });

  it('a jelölő előtt a fejléc kommenten kívül csak whitespace áll', () => {
    const content = readFileSync(path.join(directory, 'pagination.css'), 'utf8');
    expect(extractCodeBeforeStartMarker(content).trim()).toBe('');
  });
});
