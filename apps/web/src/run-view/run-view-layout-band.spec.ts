// A sáv választó tiszta függvénye, PLUS a töréspont literálok token
// sodródás védelme.
//
// MIÉRT KELL A SODRÓDÁS VÉDELEM. A `packages/ui`
// `media-query-breakpoint-invariant` regressziós tesztje kizárólag CSS
// fájlokat vizsgál (`packages/ui/src` és `apps/web/src` alatti `*.css`), a
// futás nézet sávjai viszont JS-ből váltanak, mert a `Tabs` és a `Resizable`
// DOM szerkezete és ARIA szemantikája más (lásd `run-view-layout-band.ts`).
// Ez a teszt a JS oldali párja: a két query literált MAGÁBÓL a token
// fájlból olvasott értékkel hasonlítja, tehát kitalált töréspont nem
// kerülhet be, és egy tokent érintő design system frissítés nem csúszhat el
// csendben a felülettől.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  RUN_VIEW_HORIZONTAL_MEDIA_QUERY,
  RUN_VIEW_VERTICAL_MEDIA_QUERY,
  resolveRunViewLayoutBand,
} from './run-view-layout-band.ts';

const BREAKPOINTS_CSS_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  'packages',
  'ui',
  'src',
  'design-token',
  'breakpoints.css',
);

function breakpointTokenValue(tokenName: string): number {
  const content = readFileSync(BREAKPOINTS_CSS_PATH, 'utf8');
  const match = new RegExp(String.raw`${tokenName}:\s*(\d+)px`).exec(content);
  if (match?.[1] === undefined) {
    throw new Error(`A ${tokenName} token nem található a breakpoints.css fájlban.`);
  }
  return Number(match[1]);
}

describe('resolveRunViewLayoutBand', () => {
  it('a --ep-screen-lg és fölötte vízszintes osztás', () => {
    expect(resolveRunViewLayoutBand(true, true)).toBe('horizontal');
  });

  it('a --ep-screen-md és a --ep-screen-lg között függőleges osztás', () => {
    expect(resolveRunViewLayoutBand(false, true)).toBe('vertical');
  });

  it('a --ep-screen-md alatt fülek', () => {
    expect(resolveRunViewLayoutBand(false, false)).toBe('tabs');
  });
});

describe('a futás nézet töréspont literáljai a breakpoints.css tokenjei', () => {
  it('a vízszintes sáv query literálja a --ep-screen-lg token értéke', () => {
    expect(RUN_VIEW_HORIZONTAL_MEDIA_QUERY).toBe(`(min-width: ${String(breakpointTokenValue('--ep-screen-lg'))}px)`);
  });

  it('a függőleges sáv query literálja a --ep-screen-md token értéke', () => {
    expect(RUN_VIEW_VERTICAL_MEDIA_QUERY).toBe(`(min-width: ${String(breakpointTokenValue('--ep-screen-md'))}px)`);
  });

  it('a két töréspont közül a vízszintes a szélesebb, tehát a sorrend nem cserélhető fel', () => {
    expect(breakpointTokenValue('--ep-screen-lg')).toBeGreaterThan(breakpointTokenValue('--ep-screen-md'));
  });
});
