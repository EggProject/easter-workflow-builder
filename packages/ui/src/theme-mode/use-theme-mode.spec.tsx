// Teszt megjegyzés a matchMedia mockolás módjáról: SAJÁT MÉRÉS (2026-09-01)
// igazolta, hogy a pinelt happy-dom@20.11.6 `matchMedia()` hívása minden
// egyes alkalommal ÚJ, egymástól független MediaQueryList példányt ad
// vissza ugyanarra a query stringre (nincs a böngészőkben szokásos
// dokumentum-szintű cache). Emiatt a hook belső `globalThis.matchMedia(...)`
// hívása és a teszt saját hívása KÉT KÜLÖN objektumot kapna: egy a tesztben
// dispatch-elt "change" esemény nem jutna el a hook feliratkozásához. A
// teszt ezért `vi.spyOn(globalThis, 'matchMedia')`-val egyetlen, megosztott
// MediaQueryList példányra kényszeríti mindkét felet.
import { act } from 'react';
import type { ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { THEME_MODE_STORAGE_KEY, type ThemeMode } from './theme-mode.ts';
import { useThemeMode, type UseThemeModeResult } from './use-theme-mode.ts';

interface ProbeProperties {
  readonly onResult: (result: UseThemeModeResult) => void;
}

function ThemeModeProbe({ onResult }: ProbeProperties): ReactElement {
  const result = useThemeMode();
  onResult(result);
  return <span>{result.mode}</span>;
}

describe('useThemeMode', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: UseThemeModeResult | undefined;
  let sharedMedia: MediaQueryList;

  beforeEach(() => {
    globalThis.localStorage.clear();
    delete document.documentElement.dataset['theme'];
    latest = undefined;

    sharedMedia = globalThis.matchMedia('(prefers-color-scheme: dark)');
    Object.defineProperty(sharedMedia, 'matches', { value: false, configurable: true });
    vi.spyOn(globalThis, 'matchMedia').mockReturnValue(sharedMedia);

    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    delete document.documentElement.dataset['theme'];
    vi.restoreAllMocks();
  });

  function render(): void {
    act(() => {
      root.render(
        <ThemeModeProbe
          onResult={(result) => {
            latest = result;
          }}
        />,
      );
    });
  }

  function currentResult(): UseThemeModeResult {
    if (latest === undefined) {
      throw new Error('a hook meg nem renderelt eredmenyt');
    }
    return latest;
  }

  function setMode(mode: ThemeMode): void {
    act(() => {
      currentResult().setMode(mode);
    });
  }

  it('localStorage bejegyzés hiányában a kezdő mód "system"', () => {
    render();
    expect(currentResult().mode).toBe('system');
  });

  it('a THEME_MODE_STORAGE_KEY ismeretlen értéke esetén is "system" a kezdő mód', () => {
    globalThis.localStorage.setItem(THEME_MODE_STORAGE_KEY, 'auto');
    render();
    expect(currentResult().mode).toBe('system');
  });

  it('a THEME_MODE_STORAGE_KEY tárolt értékét olvassa be kezdő módként', () => {
    globalThis.localStorage.setItem(THEME_MODE_STORAGE_KEY, 'dark');
    render();
    expect(currentResult().mode).toBe('dark');
  });

  // Mind a hat lehetséges átmenet a három mód között (SPEC-007 T-008-10).
  it('light -> dark: az attribútum megjelenik, a localStorage frissül', () => {
    render();
    setMode('light');
    setMode('dark');
    expect(currentResult().mode).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(globalThis.localStorage.getItem(THEME_MODE_STORAGE_KEY)).toBe('dark');
  });

  it.each<[ThemeMode, ThemeMode]>([
    ['dark', 'light'],
    ['light', 'system'],
    ['dark', 'system'],
    ['system', 'light'],
  ])('%s -> %s: nincs data-theme attribútum (világos OS preferencia mellett)', (fromMode, toMode) => {
    render();
    setMode(fromMode);
    setMode(toMode);
    expect(currentResult().mode).toBe(toMode);
    expect(document.documentElement.dataset['theme']).toBeUndefined();
  });

  it('system -> dark', () => {
    render();
    setMode('system');
    setMode('dark');
    expect(currentResult().mode).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });

  it('system módban az OS sötét preferenciája "dark" attribútumra rajzol át', () => {
    render();
    setMode('system');
    act(() => {
      Object.defineProperty(sharedMedia, 'matches', { value: true, configurable: true });
      sharedMedia.dispatchEvent(new Event('change'));
    });
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });

  it('a matchMedia change eseményére kizárólag system módban van feliratkozás', () => {
    const addSpy = vi.spyOn(sharedMedia, 'addEventListener');
    const removeSpy = vi.spyOn(sharedMedia, 'removeEventListener');

    render(); // kezdő mód "system" (nincs localStorage bejegyzés)
    expect(addSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledTimes(0);

    setMode('dark');
    expect(removeSpy).toHaveBeenCalledTimes(1);

    setMode('system');
    expect(addSpy).toHaveBeenCalledTimes(2);
  });
});
