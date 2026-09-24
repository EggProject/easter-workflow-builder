import { useSyncExternalStore } from 'react';

function subscribe(onStoreChange: () => void): () => void {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => {
    observer.disconnect();
  };
}

function isDarkThemeApplied(): boolean {
  return document.documentElement.dataset['theme'] === 'dark';
}

/**
 * Az élőben alkalmazott sötét téma jelzője. A `packages/ui` `useThemeMode`
 * hook oldja fel a módot (`localStorage`, `matchMedia`) és írja a
 * `<html data-theme="dark">` attribútumot; ez a hook azt a feloldást nem
 * ismétli meg, csak a már alkalmazott DOM állapotot figyeli
 * `MutationObserver`-rel, hogy élő témaváltásnál (újratöltés nélkül) is
 * naprakész maradjon (user döntés, 2026-09-23, `.claude/CLAUDE.md` 11.
 * szekció).
 */
export function useIsDarkTheme(): boolean {
  return useSyncExternalStore(subscribe, isDarkThemeApplied, isDarkThemeApplied);
}
