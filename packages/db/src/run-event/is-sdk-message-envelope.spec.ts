/* eslint-disable unicorn/no-null -- a nyers SDK üzenet JSON-ból is érkezhet, ahol a `null` valódi
   érték; azt kell elutasítani, nem a helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import { isSdkMessageEnvelope } from './is-sdk-message-envelope.ts';

describe('isSdkMessageEnvelope', () => {
  it('igazat ad a nem üres szöveges type mezőt hordozó rekordra', () => {
    expect(isSdkMessageEnvelope({ type: 'assistant' })).toBe(true);
    expect(isSdkMessageEnvelope({ type: 'system', subtype: 'init' })).toBe(true);
    // Ismeretlen `type` is boríték: a zárt `kind` listára szűkítés a
    // normalizáló dolga, nem ezé a guardé.
    expect(isSdkMessageEnvelope({ type: 'keep_alive' })).toBe(true);
  });

  it('hamisat ad, ha a type mező hiányzik, üres vagy nem szöveg', () => {
    expect(isSdkMessageEnvelope({})).toBe(false);
    expect(isSdkMessageEnvelope({ type: '' })).toBe(false);
    expect(isSdkMessageEnvelope({ type: 7 })).toBe(false);
    expect(isSdkMessageEnvelope({ type: null })).toBe(false);
    expect(isSdkMessageEnvelope({ subtype: 'init' })).toBe(false);
  });

  it('hamisat ad nem rekord bemenetre', () => {
    expect(isSdkMessageEnvelope(null)).toBe(false);
    expect(isSdkMessageEnvelope(undefined)).toBe(false);
    expect(isSdkMessageEnvelope('assistant')).toBe(false);
    expect(isSdkMessageEnvelope(7)).toBe(false);
    expect(isSdkMessageEnvelope([{ type: 'assistant' }])).toBe(false);
  });

  it('szűkíti a típust, tehát a type mező szövegként olvasható', () => {
    const value: unknown = { type: 'result', subtype: 'success' };
    if (!isSdkMessageEnvelope(value)) {
      throw new Error('a borítéknak igazat kellene adnia');
    }
    expect(value.type).toBe('result');
    expect(value['subtype']).toBe('success');
  });
});
