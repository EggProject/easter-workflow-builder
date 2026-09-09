import { describe, expect, it } from 'vitest';
import { SessionModeSchema } from './session-mode.ts';

describe('SessionModeSchema', () => {
  it('mindkét módot elfogadja', () => {
    expect(SessionModeSchema.safeParse('isolated').success).toBe(true);
    expect(SessionModeSchema.safeParse('continued').success).toBe(true);
  });

  it('ismeretlen módot elutasít', () => {
    expect(SessionModeSchema.safeParse('unknown_mode').success).toBe(false);
  });
});
