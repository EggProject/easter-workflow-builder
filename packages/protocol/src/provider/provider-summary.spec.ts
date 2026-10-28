import { describe, expect, it } from 'vitest';
import { ProviderSummarySchema } from './provider-summary.ts';

describe('ProviderSummarySchema', () => {
  it('elfogadja az azonosítót, nevet, modell- és env-lista mezőt', () => {
    const outcome = ProviderSummarySchema.safeParse({
      id: 'minimax',
      displayName: 'MiniMax',
      models: ['MiniMax-M3.1-Flash'],
      requiredEnvNames: [['ANTHROPIC_BASE_URL'], ['ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_API_KEY']],
    });
    expect(outcome.success).toBe(true);
  });

  it('elutasítja az üres névcsoportot (SPEC-013 4.8)', () => {
    const outcome = ProviderSummarySchema.safeParse({
      id: 'minimax',
      displayName: 'MiniMax',
      models: [],
      requiredEnvNames: [[]],
    });
    expect(outcome.success).toBe(false);
  });

  it('elutasítja a csoport nélküli, sima szöveg elemet', () => {
    const outcome = ProviderSummarySchema.safeParse({
      id: 'minimax',
      displayName: 'MiniMax',
      models: [],
      requiredEnvNames: ['ANTHROPIC_AUTH_TOKEN'],
    });
    expect(outcome.success).toBe(false);
  });

  it('elutasítja, ha env változó ÉRTÉKET próbálnak vinni egy nem deklarált mezőn (9. kritérium)', () => {
    const outcome = ProviderSummarySchema.safeParse({
      id: 'minimax',
      displayName: 'MiniMax',
      models: [],
      requiredEnvNames: [],
      apiKey: 'sk-secret',
    });
    expect(outcome.success).toBe(false);
  });
});
