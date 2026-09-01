import type { ReactElement } from 'react';
import type { ThemeMode } from './theme-mode.ts';
import { useThemeMode } from './use-theme-mode.ts';

const NEXT_MODE: Readonly<Record<ThemeMode, ThemeMode>> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};

const MODE_LABEL: Readonly<Record<ThemeMode, string>> = {
  light: 'világos',
  dark: 'sötét',
  system: 'rendszerkövető',
};

/**
 * A design-token/theme-toggle.css `.ep-theme-toggle` gombja, három módra
 * kiterjesztve (SPEC-007 5.4, T-008-10). A hold/nap SVG jelölés bájtra
 * azonos a forrás eggproject-design-app-common/skeletons/shell-topnav.html
 * markupjával. A `data-ep-theme-toggle` attribútum szándékosan NEM kerül
 * át: az a forrás vanilla JS (`_theme.js`) esemény-delegálásának hookja,
 * itt a React `onClick` veszi át a szerepét (T-008-10 elfogadási
 * kritérium). Kattintásra a mód körbefordul: light -> dark -> system ->
 * light.
 */
export function ThemeModeToggle(): ReactElement {
  const { mode, setMode } = useThemeMode();

  return (
    <button
      className="ep-theme-toggle"
      type="button"
      aria-label={`Téma: ${MODE_LABEL[mode]}`}
      onClick={() => {
        setMode(NEXT_MODE[mode]);
      }}
    >
      <svg
        className="ep-theme-toggle__moon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
      <svg
        className="ep-theme-toggle__sun"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    </button>
  );
}
