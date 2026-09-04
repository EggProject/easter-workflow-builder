// Bajtszintu osszehasonlito regresszios teszt: az atemelt logo-mark.svg a
// forras `eggproject-design` skill `assets/logo-mark.svg` fajljaval bajtra
// azonos maradjon. A skill konyvtar a felhasznalo gepen el, verziokovetes
// nelkul (ugyanaz az indok, mint a design-token es a self-hosted-font
// temaban, SPEC-007 4.2), tehat futasidoben (CI-ben, mas gepen) nem
// erheto el - a teszt ezert a forrasbol EGYSZER, ebben a munkamenetben
// kiszamitott SHA-256 lenyomathoz hasonlitja a repoban allo masolatot.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const directory = path.dirname(fileURLToPath(import.meta.url));

const LOGO_MARK_SHA256 = '34a6bb4d51ca1461e9cf34d7ef2034b5a6a4250161fcc6d0ae417f0205454fbf';

describe('brand-mark bajtazonossag a forrassal', () => {
  it('a logo-mark.svg bajtra azonos a forrassal', () => {
    const content = readFileSync(path.join(directory, 'logo-mark.svg'));
    expect(createHash('sha256').update(content).digest('hex')).toBe(LOGO_MARK_SHA256);
  });
});
