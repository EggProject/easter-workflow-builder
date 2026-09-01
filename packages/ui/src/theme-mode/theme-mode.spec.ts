import { describe, expect, it } from 'vitest';
import { isThemeMode, THEME_MODE_STORAGE_KEY, THEME_MODE_VALUES } from './theme-mode.ts';

describe('theme-mode', () => {
  it('a THEME_MODE_VALUES pontosan a harom modot sorolja fel', () => {
    expect(THEME_MODE_VALUES).toEqual(['light', 'dark', 'system']);
  });

  it('a THEME_MODE_STORAGE_KEY erteke "eggTheme"', () => {
    expect(THEME_MODE_STORAGE_KEY).toBe('eggTheme');
  });

  it.each(THEME_MODE_VALUES)('isThemeMode igazat ad a(z) "%s" ertekre', (mode) => {
    expect(isThemeMode(mode)).toBe(true);
  });

  it('isThemeMode hamisat ad ismeretlen string ertekre', () => {
    expect(isThemeMode('auto')).toBe(false);
  });

  it('isThemeMode hamisat ad nem string erteke (szam, undefined)', () => {
    expect(isThemeMode(42)).toBe(false);
    expect(isThemeMode(undefined)).toBe(false);
  });
});
