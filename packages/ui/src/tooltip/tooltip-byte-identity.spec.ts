// Bájtszintű regressziós teszt a tooltip témára (2026-10-14). A forrás skill
// könyvtár futásidőben nem érhető el, ezért a lenyomat fix literál, a
// forrásból 2026-10-14-én kiszámítva, ugyanaz az indok, mint a resizable
// témában (`resizable-byte-identity.spec.ts`). A forrás fájl a komponens
// előtt demó oldal szabályokat is hordoz (globális reset, `.btn*`,
// `.toolbar*`), azok nem kerültek át, lásd a `tooltip.css` fejlécét. A
// komponens blokk a nyitó kommenttől a fájl végéig bájtra azonos.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const directory = path.dirname(fileURLToPath(import.meta.url));

/**
 * A forrás `tooltip.css` komponens blokkjának SHA-256 lenyomata a "TOOLTIP"
 * nyitó kommentjétől a fájl végéig, tehát a demó oldal szabályai és az
 * `@import` sor nélkül.
 */
const TRANSPLANTED_BLOCK_SHA256 = '658e439e4e9f5e3110e5d245fdada5eb919f2ad3af7046d27ee047ee6957b2bb';

/**
 * A forrás komponens blokkjának nyitó kommentje. A forrásban gondolatjel áll
 * benne, itt Unicode escape, mert egy literál karakter a saját forrásfájlt
 * is megbuktatná a `no-em-dash` tesztben.
 */
const START_MARKER = '/* ============ TOOLTIP \u{2014} the actual component ============ */';

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

describe('tooltip bájtazonosság a forrással', () => {
  it('a tooltip.css a komponens blokk nyitó kommentjétől bájtra azonos a forrással', () => {
    const content = readFileSync(path.join(directory, 'tooltip.css'), 'utf8');
    const block = extractTransplantedBlock(content);
    expect(createHash('sha256').update(block).digest('hex')).toBe(TRANSPLANTED_BLOCK_SHA256);
  });

  it('a jelölő előtt a fejléc kommenten kívül csak whitespace áll', () => {
    const content = readFileSync(path.join(directory, 'tooltip.css'), 'utf8');
    expect(extractCodeBeforeStartMarker(content).trim()).toBe('');
  });
});
