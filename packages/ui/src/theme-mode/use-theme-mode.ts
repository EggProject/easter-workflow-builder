import { useCallback, useEffect, useState } from 'react';
import { isThemeMode, THEME_MODE_STORAGE_KEY, type ThemeMode } from './theme-mode.ts';

export interface UseThemeModeResult {
  readonly mode: ThemeMode;
  readonly setMode: (mode: ThemeMode) => void;
}

function readStoredThemeMode(): ThemeMode {
  const raw = globalThis.localStorage.getItem(THEME_MODE_STORAGE_KEY);
  return isThemeMode(raw) ? raw : 'system';
}

function isDarkColorSchemePreferred(): boolean {
  return globalThis.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * A mód "sötét"-re oldódik-e fel. A "system" mód nem ír önálló DOM
 * állapotot (SPEC-007 T-008-10 elfogadási kritérium): a `dark` és a
 * `system` (OS sötét preferenciával) UGYANARRA a `data-theme="dark"`
 * attribútumra oldódik fel, a `light` és a `system` (OS világos
 * preferenciával) pedig az attribútum HIÁNYÁRA.
 */
function isDarkTheme(mode: ThemeMode): boolean {
  switch (mode) {
    case 'dark': {
      return true;
    }
    case 'light': {
      return false;
    }
    case 'system': {
      return isDarkColorSchemePreferred();
    }
  }
}

function applyThemeModeToDocument(mode: ThemeMode): void {
  if (isDarkTheme(mode)) {
    document.documentElement.dataset['theme'] = 'dark';
  } else {
    delete document.documentElement.dataset['theme'];
  }
}

/**
 * A háromállapotú téma mód React hook alakja (SPEC-007 5.4, T-008-10). A
 * `<html>` `data-theme` attribútumát és a `localStorage['eggTheme']`
 * kulcsot ez a hook tartja szinkronban a móddal. `system` módban a
 * `matchMedia('(prefers-color-scheme: dark)')` `change` eseményére újra
 * feloldja a témát; más módban nem figyel az eseményre.
 */
export function useThemeMode(): UseThemeModeResult {
  const [mode, setModeState] = useState<ThemeMode>(readStoredThemeMode);

  useEffect(() => {
    applyThemeModeToDocument(mode);

    if (mode !== 'system') {
      return;
    }

    const media = globalThis.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (): void => {
      applyThemeModeToDocument(mode);
    };
    media.addEventListener('change', handleChange);
    return () => {
      media.removeEventListener('change', handleChange);
    };
  }, [mode]);

  const setMode = useCallback((nextMode: ThemeMode): void => {
    globalThis.localStorage.setItem(THEME_MODE_STORAGE_KEY, nextMode);
    setModeState(nextMode);
  }, []);

  return { mode, setMode };
}
