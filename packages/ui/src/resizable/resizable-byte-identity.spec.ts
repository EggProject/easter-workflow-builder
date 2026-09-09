// Bajtszintu regresszios teszt a resizable temara (PLAN-009 T-009-11). A
// forras skill konyvtar futasidoben nem erheto el, ezert a lenyomat fix
// literal, a forrasbol 2026-09-05-en kiszamitva - ugyanaz az indok, mint a
// topnav-shell temaban (topnav-shell-byte-identity.spec.ts).
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const directory = path.dirname(fileURLToPath(import.meta.url));

/**
 * A forras resizable.css `@import` sora es az azt koveto ures sor NELKUL,
 * a `/* ============ Resizable` jelolotol a fajl vegeig tarto blokk
 * SHA-256 lenyomata.
 */
const TRANSPLANTED_BLOCK_SHA256 = '27807c69185f97e53cd41478927c4d551c3567d1cf9100d9e72fd912641932f7';

const START_MARKER = '/* ============ Resizable ============';

function extractTransplantedBlock(fileContent: string): string {
  const startIndex = fileContent.indexOf(START_MARKER);
  if (startIndex === -1) {
    throw new Error('Az atemelt blokk kezdo jelolője nem talalhato a fajlban.');
  }
  return fileContent.slice(startIndex);
}

describe('resizable bajtazonossag a forrassal', () => {
  it('a resizable.css a fejlec komment utan bajtra azonos a forrassal', () => {
    const content = readFileSync(path.join(directory, 'resizable.css'), 'utf8');
    const block = extractTransplantedBlock(content);
    expect(createHash('sha256').update(block).digest('hex')).toBe(TRANSPLANTED_BLOCK_SHA256);
  });
});
