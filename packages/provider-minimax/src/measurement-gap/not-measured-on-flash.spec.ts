import { describe, expect, it } from 'vitest';
import { notMeasuredOnFlash } from './not-measured-on-flash.ts';

describe('notMeasuredOnFlash', () => {
  it('unknown tényt ad a megadott blokkoló mérésekkel, mérési azonosító nélküli indoklással', () => {
    const fact = notMeasuredOnFlash<boolean>(['M-05', 'M-09']);

    expect(fact).toStrictEqual({
      state: 'unknown',
      reason: 'Az előző modellre mérve, a MiniMax-M3.1-Flash modellre nem mérve (SPEC-013 3.2).',
      blockedBy: ['M-05', 'M-09'],
    });
    expect(fact.state === 'unknown' ? fact.reason : '').not.toMatch(/\bM-\d/);
  });
});
