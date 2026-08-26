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
  },
});
