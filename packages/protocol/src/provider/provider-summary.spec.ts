import { describe, expect, it } from 'vitest';
import { ProviderSummarySchema } from './provider-summary.ts';

describe('ProviderSummarySchema', () => {
  it('elfogadja az azonosítót, nevet, modell- és env-lista mezőt', () => {
    const outcome = ProviderSummarySchema.safeParse({
      id: 'minimax',
      displayName: 'MiniMax',
      models: ['MiniMax-M3'],
      requiredEnvNames: ['MINIMAX_API_KEY'],
    });
    expect(outcome.success).toBe(true);
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
