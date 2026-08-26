// Gyoker Vitest 4 konfiguracio (SPEC-001 9. szekcio). A `test.projects` mezo a
// jelenleg dokumentalt, ajanlott alak tobbcsomagos monorepohoz - a
// `vitest.workspace.ts` / `defineWorkspace` 3.2 ota deprecated, funkcionalisan
// ugyanaz mint a `projects`.
// Forras: https://vitest.dev/guide/projects ("This feature is also known as a
// `workspace`. The `workspace` is deprecated since 3.2 and replaced with the
// `projects` configuration. They are functionally the same.")
//
// A `coverage` blokk KIZAROLAG itt, a gyoker configban ertelmezheto: a Vitest
// dokumentacioja a `coverage`-t explicit "Unsupported Option"-kent sorolja fel
// projekt szinten, mert a lefedettseg a TELJES futashoz tartozik, nem
// projektenkent. Forras: https://vitest.dev/guide/projects, "Configuration"
// szakasz, "Unsupported Options": "coverage: coverage is done for the whole
// process".
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Minden `packages/*` es `apps/*` alkonyvtar sajat Vitest "projekt" -
    // akkor is, ha nincs benne sajat vitest.config.ts (ilyenkor Node
    // kornyezettel fut, ez a Vitest alapertelmezese). Az `apps/web` es a
    // `packages/ui` sajat vitest.config.ts-t kapott a bongeszo-jellegu
    // (happy-dom) kornyezethez (SPEC-001 9. szekcio).
    //
    // A harmadik bejegyzes NEM resze a SPEC-001 9. szekcioban leirt
    // "packages/*, apps/*" listanak: ez egy explicit, dokumentalt
    // kiegeszites, amit a jelen feladat (regresszios teszt egy valos
    // wire-probe bugra) tesz szuksegesse. A `tools/wire-probe` a SPEC-001
    // 13. szekcioja szerint NEM kap `test` npm scriptet es a coverage
    // kapubol is ki van zarva (lasd lent) - de a CLAUDE.md kotelezove teszi,
    // hogy minden javitott bugot teszt fedjen, es az egyetlen mod, hogy ez a
    // teszt egyaltalan lefusson, ha a gyoker Vitest folyamat (ami egyetlen
    // process, lasd a coverage megjegyzest fent) explicit felveszi. A
    // beallitas kizarolag a regresszios teszt fajlra szukit - a wire-probe
    // tobbi fajlja (probe/proxy/summary, amik valos MiniMax API hivast
    // tesznek) sosem futnak tesztkent.
    projects: [
      'packages/*',
      'apps/*',
      {
        extends: true,
        test: {
          name: 'wire-probe-regression',
          environment: 'node',
          include: ['tools/wire-probe/src/**/*.{test,spec}.ts'],
        },
      },
    ],

    // Jelenleg minden csomag ures, placeholder tartalommal all (lasd
    // packages/*/src/index.ts), tehat a wire-probe-regression projekten
    // kivul egyetlen projektben sincs meg tesztfajl. `passWithNoTests`
    // nelkul a Vitest ezert hibaval lepne ki.
    // Forras: https://vitest.dev/config/passwithnotests (alapertelmezes
    // `false`: "Vitest will not fail, if no tests will be found" csak
    // `true` mellett igaz).
    passWithNoTests: true,

    coverage: {
      provider: 'v8',
      // text: a tooling/scripts/test.sh sajat osszegzojenek forrasa nem ez,
      // hanem a json-summary, de a text hasznos helyi/ad-hoc futtatasnal.
      // json-summary: gepi olvashato "total" kulcs, pct ertekekkel
      // metrikankent - ezt olvassa a tooling/scripts/test.sh.
      // html + lcov: CI artefaktum es helyi bongeszheto riport.
      reporter: ['text', 'json-summary', 'html', 'lcov'],

      // Vitest 4-ben a `coverage.all` megszunt, es az alapertelmezett
      // `include` csak a teszt futas alatt ENNYIRE betoltott fajlokat fedi -
      // explicit listat kell adni, hogy a meg nem tesztelt fajlok is
      // szamitsanak a lefedettsegbe.
      // Forras: https://vitest.dev/config/coverage, coverage.include:
      // "Default: Files that were imported during test run".
      include: ['packages/*/src/**/*.{ts,tsx}', 'apps/*/src/**/*.{ts,tsx}'],

      // Vitest 4-ben a `coverage.exclude` alapertelmezese ures tomb (a
      // korabbi verziok nagy beepitett kizaro listaja megszunt), tehat
      // mindent nekunk kell felsorolni, indoklassal (SPEC-001 9. szekcio).
      // Forras: https://vitest.dev/config/coverage, coverage.exclude:
      // "Default: []".
      exclude: [
        // idegen kod
        '**/node_modules/**',
        // generalt kimenet
        '**/dist/**',
        '**/build/**',
        // konfiguracio, nem viselkedes
        '**/*.config.{ts,js,mts,mjs,cjs}',
        // csak tipus, nincs futasideju sor
        '**/*.d.ts',
        // barrel fajlok: csak ujraexport, futasideju elagazas nelkul
        '**/index.ts',
        // merooeszkoz, nem termekkod (SPEC-000 hatokore); nincs `test`
        // scriptje, a regresszios teszt fajlja kulon projektkent fut (lasd
        // fent), de maga a merooeszkoz forrasa nem resze a kuszobnek
        'tools/wire-probe/**',
        // build eszkoz
        'tooling/**',
        // generalt Drizzle migracio
        'packages/db/**/migrations/**',
        // maga a teszt
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/e2e/**',

        // IDEIGLENES kizaras: az `apps/web/src/main.ts` a Playwright e2e
        // infrastruktura vazahoz keszult minimalis bongeszo belepesi pont
        // (lasd a fajl sajat megjegyzeset), NEM a tenyleges alkalmazas -
        // azt egy kesobbi specifikacio adja. Egyetlen elagazast tartalmaz
        // (nullellenorzes a `#root` elemre), aminek 100%-os Vitest unit
        // lefedettsege csak ugy lenne elerheto, ha erre a triviális
        // helyorzore irnank egy tesztet, amit a feladat kifejezetten nem
        // ker. SZIGORITANI KELL: amint a valodi UI belepesi pont felvaltja
        // ezt a fajlt, ez a sor torlendo.
        'apps/web/src/main.ts',
      ],

      // A dokumentalt, egykapcsolos alak mind a negy metrikan 100
      // szazalekra. Forras: https://vitest.dev/config/coverage,
      // coverage.thresholds.100: "Sets global thresholds to 100. Shortcut
      // for --coverage.thresholds.lines 100 --coverage.thresholds.functions
      // 100 --coverage.thresholds.branches 100 --coverage.thresholds.statements 100."
      thresholds: {
        100: true,
      },
    },
  },
});
