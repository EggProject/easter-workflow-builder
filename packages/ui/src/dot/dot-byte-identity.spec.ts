// Bájtszintű regressziós teszt a dot témára (2026-09-23). A forrás skill
// könyvtár futásidőben nem érhető el, ezért a lenyomat fix literál, a
// forrásból 2026-09-23-án kiszámítva, ugyanaz az indok, mint a resizable
// témában (`resizable-byte-identity.spec.ts`).
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const directory = path.dirname(fileURLToPath(import.meta.url));

/**
 * A forrás `dot.css` blokkjának SHA-256 lenyomata a saját nyitó kommentjétől
 * a fájl végéig, tehát az `@import` sor és az utána álló üres sor nélkül.
 */
const TRANSPLANTED_BLOCK_SHA256 = '9a1eea0cc442f899288b74824cd111b658af426b38841229ab0812903d4e16cf';

/**
 * A forrás nyitó kommentjének első két sora. A gondolatjel escape-pel áll,
 * mert a saját forrásfájlban literálként a `no-em-dash` kapu bukna.
 */
const START_MARKER = `/* ${'='.repeat(60)}\n   Dot \u{2014} standalone status atom`;

function extractTransplantedBlock(fileContent: string): string {
  const startIndex = fileContent.indexOf(START_MARKER);
  if (startIndex === -1) {
    throw new Error('Az átemelt blokk kezdő jelölője nem található a fájlban.');
  }
  return fileContent.slice(startIndex);
}

describe('dot bájtazonosság a forrással', () => {
  it('a dot.css a fejléc komment után bájtra azonos a forrással', () => {
    const content = readFileSync(path.join(directory, 'dot.css'), 'utf8');
    const block = extractTransplantedBlock(content);
    expect(createHash('sha256').update(block).digest('hex')).toBe(TRANSPLANTED_BLOCK_SHA256);
  });
});
