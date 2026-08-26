# apps/web/e2e

## Mi ez a mappa

Playwright e2e tesztek és a hozzájuk tartozó coverage fixture (SPEC-001 10. szekció). Nem
tartozik ide a Vitest unit teszt (azok `src/**/*.test.ts` alatt élnének) és nem tartozik
ide a tényleges UI kód sem - ez a mappa csak a Playwright futtatáshoz szükséges fájlokat
tartalmazza.

## Fájlok

| Fájl                  | Tartalom                                                                                                                                                                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tsconfig.json`       | Node környezetű tsconfig (`tooling/tsconfig/node.json` alap) - a Playwright Node alatt fut                                                                                                                                                |
| `coverage-fixture.ts` | a `@playwright/test` `page` fixture kiterjesztése: minden teszt után menti a `window.__coverage__` objektumot                                                                                                                             |
| `smoke.spec.ts`       | triviális smoke teszt: betölti a kezdőlapot, ellenőrzi a helyőrző szöveget                                                                                                                                                                |
| `.nyc_output/`        | (futásidőben keletkezik) a `coverage-fixture.ts` által mentett nyers coverage JSON fájlok, a `nyc` dokumentált "temp-dir" konvenciója szerint - `.gitignore`-olt, de a `turbo.json` `test:e2e` taskjának deklarált `outputs`-a, lásd lent |

## Szabályok

- A `coverage-fixture.ts` `declare global { var __coverage__: unknown }` ambiens
  deklarációja szükséges, mert a `page.evaluate()` callback a böngészőben fut, és a
  `unicorn/prefer-global-this` szabály miatt `globalThis`-en keresztül kell hivatkozni rá,
  nem `window`-n.
- Az e2e coverage-re **nincs küszöb** (SPEC-001 10. szekció, elfogadási kritérium 24.
  pont). A `coverage-fixture.ts` csak menti a nyers adatot, az összefésülés és jelentés az
  `apps/web/package.json` `coverage:e2e:report` scriptje (`nyc report`), ami külön,
  manuálisan futtatandó a `test:e2e` után. A gyökérből a
  `bun run coverage:e2e:report` a token takarékos
  [`tooling/scripts/e2e-coverage.sh`](../../../tooling/scripts/e2e-coverage.sh) wrappert
  hívja, ami ugyanezt futtatja, csak beszédesebb hibaüzenettel - a CI is ezt használja.
- **A `.nyc_output/` a `turbo.json` `test:e2e` taskjának deklarált `outputs`-a.** Enélkül a
  Turborepo cache találata (`cache hit, replaying logs`, `>>> FULL TURBO`) csak a naplót
  játssza vissza, a Playwright nem indul el, és a nyers coverage JSON nem keletkezik újra -
  a `coverage:e2e:report` ilyenkor `ENOENT ... scandir` hibával bukik. Pontosan ez okozta a
  CI E2E job bukását a 32994208280 futásban, miközben az előző, cache nélküli futás
  (32993421389) zöld volt. Ugyanezért szerepel az `inputs` között a
  `!**/e2e/.nyc_output/**` negáció: explicit `inputs` glob esetén a Turborepo
  [dokumentáltan](https://turborepo.com/docs/reference/configuration#inputs) nem veszi
  figyelembe a `.gitignore`-t ("Using the `inputs` key opts you out of `turbo`'s default
  behavior of considering `.gitignore`"), tehát a `**/e2e/**` minta a visszaállított nyers
  JSON-t is behúzná a hash-be, és a task soha többé nem kapna cache találatot (mérve: a
  hash `0bf79d9dbf53afc9`-ről `9938c234fe752699`-re változott, a negációval viszont
  `64a823f2ea95e9bf` maradt két futáson át).
- **A smoke teszt ténylegesen lefut** a fejlesztői sandboxban is, valódi Chromiummal
  (`bun run test:e2e`, 1 passed). Ehhez a repóban semmit nem kell átállítani, csak egy
  környezeti változót: a rootless konténerből egyetlen rendszerkönyvtár hiányzik
  (`libXdamage.so.1`, csomag `libxdamage1`), amit `sudo` nélkül is ki lehet csomagolni és
  a `LD_LIBRARY_PATH`-szal behúzni. A pontos parancsokat és a CI-re gyakorolt (nulla)
  hatás indoklását a gyökér [`CLAUDE.md`](../../../CLAUDE.md) "Teszt infrastruktúra"
  szekciója írja le. Ha a launch mégis `libXdamage.so.1: cannot open shared object file`
  hibával bukik, a `LD_LIBRARY_PATH` nincs beállítva az adott shellben.
- A `coverage-fixture.ts` működése mérve, nem elméleti: a smoke teszt után az
  `e2e/.nyc_output/` alá kerül egy nyers JSON, benne az `apps/web/src/main.ts` bejegyzése
  (`s: {"0":1,"1":1,"2":1}`), és a `bun run coverage:e2e:report` ebből 100 százalékos
  `text`/`html`/`lcov` riportot állít elő a `coverage-e2e/` alá.

## Kapcsolódó dokumentumok

- [`../../../docs/spec/SPEC-001-monorepo-toolchain.md`](../../../docs/spec/SPEC-001-monorepo-toolchain.md), 10. szekció
