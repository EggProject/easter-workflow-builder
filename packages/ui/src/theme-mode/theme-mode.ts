/**
 * A három téma mód (SPEC-007 T-008-10). A "light" és a "dark" a
 * design-token/theme-light.css illetve theme-dark.css `:root` / `[data-theme="dark"]`
 * szelektorát vezérli; a "system" nem ír önálló DOM állapotot, hanem a
 * `matchMedia('(prefers-color-scheme: dark)')` alapján a "dark" vagy a
 * hiányzó attribútum egyikére oldódik fel (lásd use-theme-mode.ts).
 */
export type ThemeMode = 'light' | 'dark' | 'system';

export const THEME_MODE_VALUES = ['light', 'dark', 'system'] as const satisfies readonly ThemeMode[];

// Kovariáns szélesítés `readonly string[]`-re (nem típuskényszerítés): az
// `Array<ThemeMode>.includes` paramétere `ThemeMode`-ra szűkítene, a
// típusőr bemenete viszont már csak `string`. Erre a szélesített
// változatra hívható az `.includes()` egy egyszerű `string` értékkel.
const THEME_MODE_VALUES_AS_STRINGS: readonly string[] = THEME_MODE_VALUES;

/**
 * A `localStorage` kulcs, amin a felhasználó választása perzisztálódik
 * (SPEC-007 T-008-10 elfogadási kritérium).
 */
export const THEME_MODE_STORAGE_KEY = 'eggTheme';

/**
 * Típusőr: `unknown` bemenetet fogad, mert a `localStorage.getItem` vissza
 * adott értéke és egy ismeretlen, korábbi verzióból maradt string egyaránt
 * érkezhet ide. Ismeretlen érték esetén a hívó a rendszerkövető módra esik
 * vissza (T-008-10 elfogadási kritérium).
 */
export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === 'string' && THEME_MODE_VALUES_AS_STRINGS.includes(value);
}
