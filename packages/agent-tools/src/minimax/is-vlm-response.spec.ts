import { describe, expect, it } from 'vitest';
import { isVlmResponse } from './is-vlm-response.ts';

describe('isVlmResponse', () => {
  it('hamisat ad nem objektum értékre', () => {
    expect(isVlmResponse(undefined)).toBe(false);
  });

  it('hamisat ad, ha nincs content mező', () => {
    expect(isVlmResponse({ base_resp: {} })).toBe(false);
  });

  it('igazat ad, ha van szöveges content mező', () => {
    expect(isVlmResponse({ content: 'piros' })).toBe(true);
  });
});
