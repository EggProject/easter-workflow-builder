import { describe, expect, it } from 'vitest';
import { resolveReplayCursor } from './resolve-replay-cursor.ts';

describe('resolveReplayCursor', () => {
  it('nincs kurzor esetén a padlót adja', () => {
    // eslint-disable-next-line unicorn/no-null -- a `cursor: number | null` paraméter valódi "nincs Last-Event-ID fejléc" állapotot hordoz, nem helyőrző `undefined`-et (SPEC-005 5.6 1. pont)
    expect(resolveReplayCursor(40, null)).toBe(40);
  });

  it('ha a kurzor nagyobb, a kurzort adja', () => {
    expect(resolveReplayCursor(40, 120)).toBe(120);
  });

  it('ha a padló nagyobb, a padlót adja', () => {
    expect(resolveReplayCursor(140, 20)).toBe(140);
  });
});
