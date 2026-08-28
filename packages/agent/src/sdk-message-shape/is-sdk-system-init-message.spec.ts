/* eslint-disable unicorn/no-null -- a `messages` folyam eleme `unknown`, és a
   guardnak kifejezetten a `null` bemenetet is el kell utasítania, nem csak a
   hiányzó (`undefined`) esetet, ezért a `null` itt szándékos negatív teszteset */
import { describe, expect, it } from 'vitest';
import { isSdkSystemInitMessage } from './is-sdk-system-init-message.ts';
import type { SdkSystemInitMessage } from './sdk-system-init-message.ts';

describe('isSdkSystemInitMessage', () => {
  it('igazat ad a `system` `init` alakra, és szűkíti a `session_id` mezőt', () => {
    const value: unknown = { type: 'system', subtype: 'init', session_id: 'sess-1' };

    expect(isSdkSystemInitMessage(value)).toBe(true);
    if (isSdkSystemInitMessage(value)) {
      const narrowed: SdkSystemInitMessage = value;
      expect(narrowed.session_id).toBe('sess-1');
    }
  });

  it('a valódi SDK üzenet más mezőinek jelenléte mellett is igazat ad', () => {
    // A valódi `SDKSystemMessage` (sdk.d.ts) jóval több mezőt hordoz; a guard
    // ezeket nem utasítja el, csak a három relevánsat követeli meg.
    expect(
      isSdkSystemInitMessage({
        type: 'system',
        subtype: 'init',
        session_id: 'sess-1',
        model: 'claude-teszt',
        cwd: '/tmp',
      }),
    ).toBe(true);
  });

  it('hamisat ad, ha a `type` nem `system`', () => {
    expect(isSdkSystemInitMessage({ type: 'result', subtype: 'init', session_id: 'sess-1' })).toBe(false);
  });

  it('hamisat ad, ha a `subtype` nem `init`', () => {
    expect(isSdkSystemInitMessage({ type: 'system', subtype: 'status', session_id: 'sess-1' })).toBe(false);
  });

  it('hamisat ad, ha a `session_id` hiányzik vagy nem szöveg', () => {
    expect(isSdkSystemInitMessage({ type: 'system', subtype: 'init' })).toBe(false);
    expect(isSdkSystemInitMessage({ type: 'system', subtype: 'init', session_id: 7 })).toBe(false);
  });

  it('hamisat ad nem rekord bemenetre', () => {
    expect(isSdkSystemInitMessage(undefined)).toBe(false);
    expect(isSdkSystemInitMessage(null)).toBe(false);
    expect(isSdkSystemInitMessage('system')).toBe(false);
    expect(isSdkSystemInitMessage(['system', 'init'])).toBe(false);
  });
});
