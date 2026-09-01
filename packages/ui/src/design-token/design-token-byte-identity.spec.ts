// Bajtszintu osszehasonlito regresszios teszt: a design-token temaba atemelt
// CSS fajlok a forras `eggproject-design` skill tokeneivel bajtra azonosak
// maradjanak. A skill konyvtar a felhasznalo gepen el, verziokovetes nelkul
// (SPEC-007 4.2), tehat futasidoben (CI-ben, mas gepen) nem erheto el - a
// teszt ezert a forrasbol EGYSZER, ebben a munkamenetben kiszamitott SHA-256
// lenyomatokhoz hasonlitja a repoban allo masolatot, nem a live skill
// konyvtarhoz. A lenyomatok forrasa: docs/research/2026-09-01-spec007-f0-meresek.md
// melletti meres, `sha256sum` a telepitett skill fajlokon, 2026-09-01.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const directory = path.dirname(fileURLToPath(import.meta.url));

/**
 * A 11 token CSS fajl SHA-256 lenyomata a forrasban (valtozatlanul atemelve).
 */
const TOKEN_FILE_SHA256: Readonly<Record<string, string>> = {
  'breakpoints.css': 'ac50cfa08ae125f53a22d09fe469fd1470b1d5013665d555b0bd281e9ab2c31f',
  'colors.css': 'a1e5c68c307c6901e59735eb66c888bcb22379ed491cedf56c476f7905934ab7',
  'elevation.css': 'ada1c04348721198845b57463547fac7fec2e23f4dedca538f2ce66a56e3359d',
  'motion.css': '21c0b9268eee2ec5c439add2815c504db0672f5856641a8fb069247e38a64e7c',
  'radius.css': 'c1e9c7f6ced9c1df6098fd5f311ed02e852a6e576de0e3229689c0d69cae8549',
  'spacing.css': 'aef2cd4100e49b4defdde0692ae85eb3284075d50baaf6109028a3293540b31c',
  'theme-auto.css': '044a1d506ec450344ce1ee81d6285571e43096769ffa9563109fdc2ac2c88b6c',
  'theme-dark.css': '5b3175f20324dea643efaab8edcb04b57129451c4e2326b416dd8aac81eaf228',
  'theme-light.css': '6a2a16604b06873a39cf83093b89cc7190d93ddeb2132524e5e4871e11fe025d',
  'theme-toggle.css': '520e01c4b56fdadf48691151a12a7151284af373f8a1f70a75d9292ef097ae23',
  'typography.css': '57c08396aeae0e0e872308460921aa02cc83232c70848709d1ec8dad335e25fe',
};

/**
 * A forras `colors_and_type.css` barrel SHA-256 lenyomata, valtozatlanul.
 */
const SOURCE_BARREL_SHA256 = '52a60e77f957452ed37cee347dd55c70b76cd73166dfc5620f850a5802934d78';

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

describe('design-token bajtazonossag a forrassal', () => {
  it.each(Object.entries(TOKEN_FILE_SHA256))('%s bajtra azonos a forrassal', (fileName, expectedHash) => {
    const content = readFileSync(path.join(directory, fileName), 'utf8');
    expect(sha256(content)).toBe(expectedHash);
  });

  it('a barrel kizarolag az @import utvonalakban ter el a forrastol', () => {
    const barrelContent = readFileSync(path.join(directory, 'colors-and-type.css'), 'utf8');

    // A repoban allo import utvonalakat visszaalitjuk a forras eredeti
    // alakjara, majd a rekonstrualt tartalmat hasonlitjuk a forras
    // lenyomatahoz. Ha barmi mas is valtozott volna, a lenyomat elterne.
    const reconstructedSourceContent = barrelContent
      .replace("@import url('../self-hosted-font/fonts.css');", "@import url('assets/fonts/fonts.css');")
      .replaceAll("@import url('./", "@import url('./tokens/");

    expect(sha256(reconstructedSourceContent)).toBe(SOURCE_BARREL_SHA256);
  });

  it('a barrel az uj mappaszerkezetre mutato import utvonalakat hasznal', () => {
    const barrelContent = readFileSync(path.join(directory, 'colors-and-type.css'), 'utf8');

    expect(barrelContent).toContain("@import url('../self-hosted-font/fonts.css');");
    for (const fileName of Object.keys(TOKEN_FILE_SHA256)) {
      expect(barrelContent).toContain(`@import url('./${fileName}');`);
    }
    // Az @import sorokban (nem a leiro kommentben) nem maradhat a regi
    // mappaszerkezetre mutato utvonal.
    const importLines = barrelContent.split('\n').filter((line) => line.trimStart().startsWith('@import'));
    for (const line of importLines) {
      expect(line).not.toContain('tokens/');
      expect(line).not.toContain('assets/');
    }
  });
});
