import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { COLLAPSED_TRANSCRIPT_ROW_HEIGHT } from './collapsed-transcript-row-height.ts';

const ACCORDION_CSS_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  'packages',
  'ui',
  'src',
  'accordion',
  'accordion.css',
);

/**
 * Egy CSS szabály törzse a szelektora alapján; ugyanaz a regex minta, mint a
 * `packages/ui` `AccordionItem.spec.tsx` jelölő oszlop tesztjéé.
 */
function ruleBody(css: string, selector: string): string {
  const escaped = selector.replaceAll('.', String.raw`\.`);
  return new RegExp(String.raw`(?:^|\n)${escaped}\s*\{([^}]*)\}`).exec(css)?.[1] ?? '';
}

describe('COLLAPSED_TRANSCRIPT_ROW_HEIGHT', () => {
  const css = readFileSync(ACCORDION_CSS_PATH, 'utf8');

  it('a design system forrás CSS fejléc szabályából számítódik: két függőleges belső margó plusz egy szövegsor', () => {
    const header = ruleBody(css, '.accordion__header');
    const padding = /padding:\s*(\d+)px\s+\d+px;/.exec(header);
    const font = /font:\s*\d+\s+(\d+)px\/([\d.]+)\s/.exec(header);
    if (padding?.[1] === undefined || font?.[1] === undefined || font[2] === undefined) {
      throw new Error('az .accordion__header szabály alakja megváltozott, a konstans újraszámolandó');
    }

    const expected = 2 * Number(padding[1]) + Number(font[1]) * Number(font[2]);
    expect(COLLAPSED_TRANSCRIPT_ROW_HEIGHT).toBe(expected);
  });

  it('az .accordion__item alsó szegélye a sor egyetlen, utolsó gyerek elemén nulla, tehát nem adódik hozzá', () => {
    expect(ruleBody(css, '.accordion__item:last-child')).toMatch(/border-bottom:\s*0/);
  });
});
