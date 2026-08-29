import { describe, expect, it } from 'vitest';
import { TranscriptPageSchema } from './transcript-page.ts';

describe('TranscriptPageSchema', () => {
  it('elfogadja az üres lapot', () => {
    expect(TranscriptPageSchema.safeParse({ events: [] }).success).toBe(true);
  });

  it('elutasítja az ismeretlen kulcsot', () => {
    expect(TranscriptPageSchema.safeParse({ events: [], nextCursor: 5 }).success).toBe(false);
  });
});
