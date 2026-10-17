import { describe, expect, it } from 'vitest';
import { resolveUndoModifier } from './resolve-undo-modifier.ts';

/**
 * Az asztali ügynökök alakja a Chromium frozen (reduced) formátuma, a platform
 * tokenjük a Chromium UA reduction dokumentum felsorolásából való. A mobil
 * Apple, az iPadOS asztali módú és az Android ügynök az MDN User-Agent
 * fejléc lapjának példáit követi.
 */
const MACOS_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';
const WINDOWS_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';
const LINUX_USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';
const IPHONE_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
const IPAD_MOBILE_USER_AGENT =
  'Mozilla/5.0 (iPad; CPU OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
const IPAD_DESKTOP_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15';
const ANDROID_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36';

describe('resolveUndoModifier', () => {
  it('auto esetén a Mac szót tartalmazó felhasználói ügynöknél a meta (Cmd), máskor a ctrl', () => {
    expect(resolveUndoModifier('auto', MACOS_USER_AGENT)).toBe('meta');
    expect(resolveUndoModifier('auto', WINDOWS_USER_AGENT)).toBe('ctrl');
    expect(resolveUndoModifier('auto', LINUX_USER_AGENT)).toBe('ctrl');
  });

  it('auto esetén az iOS és az iPadOS ügynök meta (a Mac szó mindegyikben szerepel), az Android ctrl', () => {
    expect(resolveUndoModifier('auto', IPHONE_USER_AGENT)).toBe('meta');
    expect(resolveUndoModifier('auto', IPAD_MOBILE_USER_AGENT)).toBe('meta');
    expect(resolveUndoModifier('auto', IPAD_DESKTOP_USER_AGENT)).toBe('meta');
    expect(resolveUndoModifier('auto', ANDROID_USER_AGENT)).toBe('ctrl');
  });

  it('auto esetén az üres felhasználói ügynök ctrl', () => {
    expect(resolveUndoModifier('auto', '')).toBe('ctrl');
  });

  it('a ctrl beállítás a felhasználói ügynöktől függetlenül ctrl', () => {
    expect(resolveUndoModifier('ctrl', MACOS_USER_AGENT)).toBe('ctrl');
    expect(resolveUndoModifier('ctrl', WINDOWS_USER_AGENT)).toBe('ctrl');
  });

  it('a meta beállítás a felhasználói ügynöktől függetlenül meta', () => {
    expect(resolveUndoModifier('meta', MACOS_USER_AGENT)).toBe('meta');
    expect(resolveUndoModifier('meta', WINDOWS_USER_AGENT)).toBe('meta');
  });
});
