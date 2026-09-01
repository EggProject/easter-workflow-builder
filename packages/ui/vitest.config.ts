// Csomag szintu Vitest projekt config, csak azert kell, mert ez a csomag
// bongeszo-jellegu kornyezetet igenyel (SPEC-001 9. szekcio: "apps/web es
// packages/ui bongeszo jellegu kornyezetet igenyel, a tobbi Node-ot"). A
// gyoker vitest.config.ts `test.projects` globja (`packages/*`) ezt a
// fajlt fedezi fel.
//
// A projekt configok semmit nem oroklenek automatikusan a gyoker
// configbol (csak a `projects` tombben INLINE definialt projektek
// tehetik ezt meg `extends: true`-val) - kulon fajlbol hivatkozott
// projektnel a megosztast magunknak kellene `mergeConfig`-gal
// osszefuznunk, de itt nincs mit oroklni: a reporter/coverage
// gyoker-only, az `include` mintakat a Vitest alapertelmezese mar
// megtalalja a csomag konyvtaraban.
// Forras: https://vitest.dev/guide/projects, "Configuration" szakasz.
import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'ui',
    environment: 'happy-dom',
    // Ket, sajat meressel feltart hiba javitasa - lasd a fajl sajat
    // fejleckommentjet (docs/research/2026-09-01-spec007-f0-meresek.md,
    // T-008-4): a React 19 act() kornyezet jelzese, es a Vitest happy-dom
    // projekt-kornyezetben nem mukodo globalThis.localStorage javitasa.
    setupFiles: ['./vitest.setup.ts'],
  },
});
