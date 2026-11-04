// Bájtszintű regressziós teszt a switch témára (2026-10-28). A forrás skill
// könyvtár futásidőben nem érhető el, ezért a lenyomat fix literál, a
// forrásból 2026-10-28-án kiszámítva, ugyanaz az indok, mint a dot témában
// (`dot-byte-identity.spec.ts`). A lenyomat a forrás `form-controls.css`
// "Switch" szakaszát fedi; a forced-colors és a reduced-motion szelektorok
// a forrás közös blokkjaiból kiemelt, szövegében változatlan szabályok,
// azok a fejlécben kimondottan nem tagjai a lenyomatnak.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const directory = path.dirname(fileURLToPath(import.meta.url));

/**
 * A forrás Switch szakaszának SHA-256 lenyomata a nyitó kommenttől az
 * utolsó Switch szabály sorvégéig.
 */
const TRANSPLANTED_BLOCK_SHA256 = '1492a5cb6213b842d27e5424eeec6c4535e49553a45863bd2a01336a68b92384';

const START_MARKER = '/* ============ Switch ============ */';
const END_MARKER = '.ctrl__input:checked + .ctrl__switch--sm::after { transform: translateX(12px); }\n';

const CSS_COMMENT_PATTERN = /\/\*[\s\S]*?\*\//g;

function findStartIndex(fileContent: string): number {
  const startIndex = fileContent.indexOf(START_MARKER);
  if (startIndex === -1) {
    throw new Error('Az átemelt blokk kezdő jelölője nem található a fájlban.');
  }
  return startIndex;
}

function extractTransplantedBlock(fileContent: string): string {
  const startIndex = findStartIndex(fileContent);
  const endIndex = fileContent.indexOf(END_MARKER, startIndex);
  if (endIndex === -1) {
    throw new Error('Az átemelt blokk záró jelölője nem található a fájlban.');
  }
  return fileContent.slice(startIndex, endIndex + END_MARKER.length);
}

/**
 * A kezdő jelölő előtti rész a kommentek nélkül. A lenyomat csak a jelölőtől
 * a záró jelölőig tartó blokkot fedi, ezért egy jelölő elé tett szabály a
 * kaszkádban felülírhatná a bájtazonos blokkot úgy, hogy a lenyomat nem
 * változik.
 */
function extractCodeBeforeStartMarker(fileContent: string): string {
  return fileContent.slice(0, findStartIndex(fileContent)).replaceAll(CSS_COMMENT_PATTERN, '');
}

describe('switch bájtazonosság a forrással', () => {
  it('a switch.css Switch szakasza bájtra azonos a forrással', () => {
    const content = readFileSync(path.join(directory, 'switch.css'), 'utf8');
    const block = extractTransplantedBlock(content);
    expect(createHash('sha256').update(block).digest('hex')).toBe(TRANSPLANTED_BLOCK_SHA256);
  });

  it('a jelölő előtt a fejléc kommenten kívül csak whitespace áll', () => {
    const content = readFileSync(path.join(directory, 'switch.css'), 'utf8');
    expect(extractCodeBeforeStartMarker(content).trim()).toBe('');
  });

  it('hiányzó kezdő jelölőnél hibát dob', () => {
    expect(() => extractTransplantedBlock('.ctrl {}')).toThrow('kezdő jelölője');
  });

  it('hiányzó záró jelölőnél hibát dob', () => {
    expect(() => extractTransplantedBlock(`${START_MARKER}\n.ctrl__switch {}\n`)).toThrow('záró jelölője');
  });
});
