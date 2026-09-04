// Csomag szintu Vitest projekt config - lasd packages/ui/vitest.config.ts
// megjegyzeset, ugyanaz az indoklas (SPEC-001 9. szekcio).
//
// Az `exclude` kiegeszitese szukseges: a `e2e/` alatt Playwright specek
// vannak (`@playwright/test` `test` fuggvenyevel, nem a Vitest-eve), a
// Vitest alapertelmezett `include` mintaja (`**/*.{test,spec}.*`) ezeket
// is felszedne, es a Playwright API hasznalata miatt hibaval elbuknanak.
// A Vitest `exclude` beallitasa MINDIG teljesen felulirja az
// alapertelmezest (nem egeszsiti ki), ezert a `configDefaults.exclude`-ot
// kell alapul venni. Forras: https://vitest.dev/config/exclude,
// "Although the CLI exclude option is additive, manually setting exclude
// in your config will replace the default value."
import { configDefaults, defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'web',
    environment: 'happy-dom',
    exclude: [...configDefaults.exclude, 'e2e/**'],
    // Ugyanaz az indok, mint a packages/ui projektnel: a React 19 act()
    // kornyezet jelzese, es a Vitest happy-dom projekt-kornyezeteben nem
    // mukodo globalThis.localStorage javitasa. Az app-shell a packages/ui
    // ThemeModeToggle komponenset rajzolja, ami localStorage-t olvas, es a
    // Vitest projekt configok semmit nem oroklenek egymastol.
    setupFiles: ['./vitest.setup.ts'],
  },
});
