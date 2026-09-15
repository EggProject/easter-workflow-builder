import { describe, expect, it } from 'vitest';
import { ThinkingModeSchema } from './thinking-mode.ts';

describe('ThinkingModeSchema', () => {
  it('mind a három módot elfogadja', () => {
    expect(ThinkingModeSchema.safeParse('disabled').success).toBe(true);
    expect(ThinkingModeSchema.safeParse('adaptive').success).toBe(true);
    expect(ThinkingModeSchema.safeParse('always_on').success).toBe(true);
  });

  it('ismeretlen módot elutasít', () => {
    expect(ThinkingModeSchema.safeParse('unknown_mode').success).toBe(false);
  });
});
