import { describe, expect, it } from 'vitest';
import { ProviderIdSchema } from './provider-id.ts';

describe('ProviderIdSchema', () => {
  it('mindkét provider azonosítót elfogadja', () => {
    expect(ProviderIdSchema.safeParse('claude-subscription').success).toBe(true);
    expect(ProviderIdSchema.safeParse('minimax').success).toBe(true);
  });

  it('ismeretlen azonosítót elutasít', () => {
    expect(ProviderIdSchema.safeParse('unknown-provider').success).toBe(false);
  });
});
