// Bájtszintű regressziós teszt a context-menu témára (2026-10-14). A forrás
// skill könyvtár futásidőben nem érhető el, ezért a lenyomat fix literál, a
// forrásból 2026-10-14-én kiszámítva, ugyanaz az indok, mint a resizable
// témában (`resizable-byte-identity.spec.ts`). A teljes forrás CSS átkerült,
// a port által nem használt szabályaival együtt (`.context-menu__target`,
// `.context-menu__separator`, `.context-menu__label`, a veszélyes, a letiltott
// és az almenü elem), lásd `ContextMenu.tsx` fejléc.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const directory = path.dirname(fileURLToPath(import.meta.url));

/**
 * A forrás `context-menu.css` blokkjának SHA-256 lenyomata a saját nyitó
 * kommentjétől a fájl végéig, tehát az `@import` sor és az utána álló üres
 * sor nélkül.
 */
const TRANSPLANTED_BLOCK_SHA256 = 'c83003b7154925067478e77740dcdf0ea5149ee452833a9576bb9de422dfe9dc';

/**
 * A forrás nyitó kommentjének első sora.
 */
const START_MARKER = '/* ============ Context Menu ============';

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

describe('context-menu bájtazonosság a forrással', () => {
  it('a context-menu.css a fejléc komment után bájtra azonos a forrással', () => {
    const content = readFileSync(path.join(directory, 'context-menu.css'), 'utf8');
    const block = extractTransplantedBlock(content);
    expect(createHash('sha256').update(block).digest('hex')).toBe(TRANSPLANTED_BLOCK_SHA256);
  });

  it('a jelölő előtt a fejléc kommenten kívül csak whitespace áll', () => {
    const content = readFileSync(path.join(directory, 'context-menu.css'), 'utf8');
    expect(extractCodeBeforeStartMarker(content).trim()).toBe('');
  });
});
