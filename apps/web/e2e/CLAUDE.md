# apps/web/e2e

## Mi ez a mappa

Playwright e2e tesztek és a hozzájuk tartozó coverage fixture (SPEC-001 10. szekció). Nem
tartozik ide a Vitest unit teszt (azok `src/**/*.test.ts` alatt élnének) és nem tartozik
ide a tényleges UI kód sem - ez a mappa csak a Playwright futtatáshoz szükséges fájlokat
tartalmazza.

## Fájlok

| Fájl                  | Tartalom                                                                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tsconfig.json`       | Node környezetű tsconfig (`tooling/tsconfig/node.json` alap) - a Playwright Node alatt fut                                                                                           |
| `coverage-fixture.ts` | a `@playwright/test` `page` fixture kiterjesztése: minden teszt után menti a `window.__coverage__` objektumot                                                                        |
| `smoke.spec.ts`       | triviális smoke teszt: betölti a kezdőlapot, ellenőrzi a helyőrző szöveget                                                                                                           |
| `.nyc_output/`        | (futásidőben keletkezik) a `coverage-fixture.ts` által mentett nyers coverage JSON fájlok, a `nyc` dokumentált "temp-dir" konvenciója szerint - `.gitignore`-olt (`coverage/` minta) |

## Szabályok

- A `coverage-fixture.ts` `declare global { var __coverage__: unknown }` ambiens
  deklarációja szükséges, mert a `page.evaluate()` callback a böngészőben fut, és a
  `unicorn/prefer-global-this` szabály miatt `globalThis`-en keresztül kell hivatkozni rá,
  nem `window`-n.
- Az e2e coverage-re **nincs küszöb** (SPEC-001 10. szekció, elfogadási kritérium 24.
  pont). A `coverage-fixture.ts` csak menti a nyers adatot, az összefésülés és jelentés az
  `apps/web/package.json` `coverage:e2e:report` scriptje (`nyc report`), ami külön,
  manuálisan futtatandó a `test:e2e` után.
- A tesztek nem futottak le ténylegesen ebben a végrehajtási környezetben: a Playwright
  Chromium letölthető volt, de a rendszerfüggőségei (`sudo` hiányában) nem telepíthetők.
  A `playwright test --list` viszont igazolta, hogy a konfiguráció és a teszt érvényes.

## Kapcsolódó dokumentumok

- [`../../../docs/spec/SPEC-001-monorepo-toolchain.md`](../../../docs/spec/SPEC-001-monorepo-toolchain.md), 10. szekció
