/* eslint-disable unicorn/no-null -- a ConcurrencyLimitView configuredMaxConcurrentSteps és suggestedLimit mezője beállítatlan/nem mért állapotban a dróton ténylegesen `null` értéket hordoz, nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import { ConcurrencyLimitViewSchema, SetConcurrencyLimitRequestSchema } from './concurrency-limit-view.ts';

describe('ConcurrencyLimitViewSchema', () => {
  it('elfogadja a beállított korlátot és a mért javaslatot egyszerre, külön mezőben', () => {
    const outcome = ConcurrencyLimitViewSchema.safeParse({
      providerId: 'minimax',
      configuredMaxConcurrentSteps: 4,
      suggestion: { suggestedLimit: 6, note: 'alsó korlát, mérésből' },
    });
    expect(outcome.success).toBe(true);
  });

  it('elfogadja a beállítatlan korlátot és a "nincs javaslat" állapotot', () => {
    const outcome = ConcurrencyLimitViewSchema.safeParse({
      providerId: 'minimax',
      configuredMaxConcurrentSteps: null,
      suggestion: { suggestedLimit: null, note: 'nincs mért javaslat' },
    });
    expect(outcome.success).toBe(true);
  });

  it('elutasítja, ha a suggestion mező hiányzik', () => {
    const outcome = ConcurrencyLimitViewSchema.safeParse({
      providerId: 'minimax',
      configuredMaxConcurrentSteps: null,
    });
    expect(outcome.success).toBe(false);
  });
});

describe('SetConcurrencyLimitRequestSchema', () => {
  it('elfogadja a pozitív egész korlátot', () => {
    expect(SetConcurrencyLimitRequestSchema.safeParse({ maxConcurrentSteps: 4 }).success).toBe(true);
  });

  it('elutasítja a nullát', () => {
    expect(SetConcurrencyLimitRequestSchema.safeParse({ maxConcurrentSteps: 0 }).success).toBe(false);
  });
});
