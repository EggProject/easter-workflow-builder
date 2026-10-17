import { describe, expect, it } from 'vitest';
import { resolveUndoModifier } from './resolve-undo-modifier.ts';

/**
 * A két felhasználói ügynök szöveg alakja a Chromium frozen (reduced)
 * formátuma, a platform tokenjük a Chromium UA reduction dokumentum
 * felsorolásából való.
 */
const MACOS_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';
const WINDOWS_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';
const LINUX_USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';

describe('resolveUndoModifier', () => {
  it('auto esetén a Mac szót tartalmazó felhasználói ügynöknél a meta (Cmd), máskor a ctrl', () => {
    expect(resolveUndoModifier('auto', MACOS_USER_AGENT)).toBe('meta');
    expect(resolveUndoModifier('auto', WINDOWS_USER_AGENT)).toBe('ctrl');
    expect(resolveUndoModifier('auto', LINUX_USER_AGENT)).toBe('ctrl');
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
