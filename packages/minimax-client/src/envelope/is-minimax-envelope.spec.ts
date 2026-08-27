import { describe, expect, it } from 'vitest';
import { isMiniMaxEnvelope } from './is-minimax-envelope.ts';

describe('isMiniMaxEnvelope', () => {
  it('hamisat ad nem objektum értékre', () => {
    expect(isMiniMaxEnvelope('szoveg')).toBe(false);
  });

  it('hamisat ad, ha nincs base_resp mező', () => {
    expect(isMiniMaxEnvelope({})).toBe(false);
  });

  it('hamisat ad, ha a base_resp mezői rossz típusúak', () => {
    expect(isMiniMaxEnvelope({ base_resp: { status_code: '0', status_msg: 'ok' } })).toBe(false);
    expect(isMiniMaxEnvelope({ base_resp: { status_code: 0, status_msg: 1 } })).toBe(false);
  });

  it('igazat ad a teljes burkolóra', () => {
    expect(isMiniMaxEnvelope({ base_resp: { status_code: 0, status_msg: 'success' } })).toBe(true);
  });
});
