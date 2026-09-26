// Bájtszintű regressziós teszt a drawer témára (2026-09-25). A forrás skill
// könyvtár futásidőben nem érhető el, ezért a lenyomat fix literál, a
// forrásból 2026-09-25-én kiszámítva, ugyanaz az indok, mint a resizable
// témában (`resizable-byte-identity.spec.ts`). A teljes forrás CSS átkerült,
// a modális panel szabályaival együtt, akkor is, ha a felület csak a törzs
// és a lábléc szerkezetét használja (`DrawerBody.tsx`, `DrawerFooter.tsx`).
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const directory = path.dirname(fileURLToPath(import.meta.url));

/**
 * A forrás `drawer.css` blokkjának SHA-256 lenyomata a saját nyitó
 * kommentjétől a fájl végéig, tehát az `@import` sor és az utána álló üres
 * sor nélkül.
 */
const TRANSPLANTED_BLOCK_SHA256 = 'bc8d3619a96df2d2969355dfaf9f03b65f41258bc5a8f22e85f2ec93d718b4c1';

/**
 * A forrás nyitó kommentjének első sora.
 */
const START_MARKER = '/* ============ Drawer / Sheet ============';

function extractTransplantedBlock(fileContent: string): string {
  const startIndex = fileContent.indexOf(START_MARKER);
  if (startIndex === -1) {
    throw new Error('Az átemelt blokk kezdő jelölője nem található a fájlban.');
  }
  return fileContent.slice(startIndex);
}

describe('drawer bájtazonosság a forrással', () => {
  it('a drawer.css a fejléc komment után bájtra azonos a forrással', () => {
    const content = readFileSync(path.join(directory, 'drawer.css'), 'utf8');
    const block = extractTransplantedBlock(content);
    expect(createHash('sha256').update(block).digest('hex')).toBe(TRANSPLANTED_BLOCK_SHA256);
  });
});
