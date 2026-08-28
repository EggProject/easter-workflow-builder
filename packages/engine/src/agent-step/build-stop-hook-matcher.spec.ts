import { describe, expect, it } from 'vitest';
import { buildStopHookMatcher } from './build-stop-hook-matcher.ts';

function callHook(input: unknown): { readonly decision?: 'block'; readonly reason?: string } {
  const [hook] = buildStopHookMatcher().hooks;
  if (hook === undefined) {
    throw new Error('a Stop hook bejegyzés visszahívás nélkül állt elő');
  }
  return hook(input);
}

describe('buildStopHookMatcher', () => {
  it('pontosan egy visszahívást tartalmaz, matcher és timeout mező nélkül', () => {
    const matcher = buildStopHookMatcher();

    expect(matcher.hooks).toHaveLength(1);
    expect(Object.keys(matcher)).toStrictEqual(['hooks']);
  });

  it('blokkoló választ ad, ha még nem fut blokkolás miatt', () => {
    const output = callHook({ hook_event_name: 'Stop', stop_hook_active: false });

    expect(output.decision).toBe('block');
    expect(output.reason).toBe('Az emit_output tool még nem futott le -- kérlek hívd meg a végeredménnyel.');
  });

  it('hiányzó stop_hook_active mező mellett is blokkol', () => {
    expect(callHook({ hook_event_name: 'Stop' }).decision).toBe('block');
  });

  it('nem rekord bemenetre is blokkol, mert az nem bizonyítja a futó blokkolást', () => {
    expect(callHook('nem rekord').decision).toBe('block');
  });

  it('stop_hook_active mellett átengedi a leállást, tehát nincs végtelen ciklus', () => {
    const output = callHook({ hook_event_name: 'Stop', stop_hook_active: true });

    expect(output).toStrictEqual({});
  });
});
