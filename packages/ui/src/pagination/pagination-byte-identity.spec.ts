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

function extractTransplantedBlock(fileContent: string): string {
  const startIndex = fileContent.indexOf(START_MARKER);
  if (startIndex === -1) {
    throw new Error('Az átemelt blokk kezdő jelölője nem található a fájlban.');
  }
  return fileContent.slice(startIndex);
}

describe('pagination bájtazonosság a forrással', () => {
  it('a pagination.css a fejléc komment után bájtra azonos a forrással', () => {
    const content = readFileSync(path.join(directory, 'pagination.css'), 'utf8');
    const block = extractTransplantedBlock(content);
    expect(createHash('sha256').update(block).digest('hex')).toBe(TRANSPLANTED_BLOCK_SHA256);
  });
});
