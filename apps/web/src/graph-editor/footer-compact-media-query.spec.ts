// A töréspont literál token sodródás védelme: a `media-query-breakpoint-invariant`
// kizárólag CSS fájlokat vizsgál, ez a JS oldali párja (a minta a
// `run-view-layout-band.spec.ts`, SPEC-008 10.).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FOOTER_COMPACT_MEDIA_QUERY } from './footer-compact-media-query.ts';

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

describe('FOOTER_COMPACT_MEDIA_QUERY', () => {
  it('a query literálja a --ep-screen-sm token értéke', () => {
    expect(FOOTER_COMPACT_MEDIA_QUERY).toBe(`(max-width: ${String(breakpointTokenValue('--ep-screen-sm'))}px)`);
  });
});
