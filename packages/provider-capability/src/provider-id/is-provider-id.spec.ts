import { describe, expect, it } from 'vitest';
import { isProviderId } from './is-provider-id.ts';

describe('isProviderId', () => {
  it('igazat ad mindkét támogatott azonosítóra', () => {
    expect(isProviderId('claude-subscription')).toBe(true);
    expect(isProviderId('minimax')).toBe(true);
  });

  it('hamisat ad ismeretlen azonosítóra', () => {
    expect(isProviderId('openai')).toBe(false);
    expect(isProviderId('')).toBe(false);
    // A keresés nem eshet át a prototípus láncra.
    expect(isProviderId('toString')).toBe(false);
  });

  it('hamisat ad nem szöveg bemenetre', () => {
    expect(isProviderId(undefined)).toBe(false);
    expect(isProviderId(1)).toBe(false);
    expect(isProviderId({ providerId: 'minimax' })).toBe(false);
  });
});
