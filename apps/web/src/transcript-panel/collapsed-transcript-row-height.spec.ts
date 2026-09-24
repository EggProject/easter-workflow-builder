import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { COLLAPSED_TRANSCRIPT_ROW_HEIGHT } from './collapsed-transcript-row-height.ts';

const THIS_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const DESIGN_SYSTEM_DIRECTORY = path.join(THIS_DIRECTORY, '..', '..', '..', '..', 'packages', 'ui', 'src');
const ACCORDION_CSS_PATH = path.join(DESIGN_SYSTEM_DIRECTORY, 'accordion', 'accordion.css');
const TYPOGRAPHY_CSS_PATH = path.join(DESIGN_SYSTEM_DIRECTORY, 'design-token', 'typography.css');
const ROW_CSS_PATH = path.join(THIS_DIRECTORY, '..', 'run-event-row', 'run-event-row.css');

/**
 * Egy CSS szabály törzse a szelektora alapján; ugyanaz a regex minta, mint a
 * `packages/ui` `AccordionItem.spec.tsx` jelölő oszlop tesztjéé.
 */
function ruleBody(css: string, selector: string): string {
  const escaped = selector.replaceAll('.', String.raw`\.`);
  return new RegExp(String.raw`(?:^|\n)${escaped}\s*\{([^}]*)\}`).exec(css)?.[1] ?? '';
}

describe('COLLAPSED_TRANSCRIPT_ROW_HEIGHT', () => {
  const accordionCss = readFileSync(ACCORDION_CSS_PATH, 'utf8');

  it('a forrás CSS-ből számítódik: a fejléc két függőleges belső margója plusz a sor fejlécére tett type token egy szövegsora', () => {
    const padding = /padding:\s*(\d+)px\s+\d+px;/.exec(ruleBody(accordionCss, '.accordion__header'));
    // A sor fejlécének betűje a `run-event-row.css` szabályából: melyik
    // design system type token, és annak mérete, sormagassága.
    const token = /font:\s*var\((--ep-text-[a-z]+)\);/.exec(
      ruleBody(readFileSync(ROW_CSS_PATH, 'utf8'), '.run-event-row .accordion__header'),
    );
    if (padding?.[1] === undefined || token?.[1] === undefined) {
      throw new Error('a fejléc szabályok alakja megváltozott, a konstans újraszámolandó');
    }
    const font = new RegExp(String.raw`${token[1]}:\s*\d+\s+(\d+)px\/([\d.]+)\s`).exec(
      readFileSync(TYPOGRAPHY_CSS_PATH, 'utf8'),
    );
    if (font?.[1] === undefined || font[2] === undefined) {
      throw new Error(`a ${token[1]} token alakja megváltozott, a konstans újraszámolandó`);
    }

    const expected = 2 * Number(padding[1]) + Number(font[1]) * Number(font[2]);
    expect(token[1]).toBe('--ep-text-small');
    expect(COLLAPSED_TRANSCRIPT_ROW_HEIGHT).toBe(expected);
  });

  it('a sor fejlécének magassága egy szövegsor plusz a forrás két függőleges belső margója, tehát a meta tartalma (a "Nem tárolt" jelvény) nem növeli', () => {
    const padding = /padding:\s*(\d+)px\s+\d+px;/.exec(ruleBody(accordionCss, '.accordion__header'));
    const height = /height:\s*calc\(1lh \+ 2 \* (\d+)px\);/.exec(
      ruleBody(readFileSync(ROW_CSS_PATH, 'utf8'), '.run-event-row .accordion__header'),
    );
    expect(height?.[1]).toBeDefined();
    expect(height?.[1]).toBe(padding?.[1]);
  });

  it('az .accordion__item alsó szegélye a sor egyetlen, utolsó gyerek elemén nulla, tehát nem adódik hozzá', () => {
    expect(ruleBody(accordionCss, '.accordion__item:last-child')).toMatch(/border-bottom:\s*0/);
  });
});
