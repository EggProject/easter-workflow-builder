# apps/web

## Mi ez a mappa

A React 19 és Vite 8 frontend alkalmazás (SPEC-007). A `packages/ui` átemelt komponenseit
fogyasztja, a drótszintű típusokat és Zod sémákat pedig kizárólag a `packages/protocol`
barreljéből veszi: saját drótszintű típus vagy séma a `src/` alatt nem állhat (SPEC-007 3.1).
A `@vitejs/plugin-react` csomag **sehol nem szerepel**: a Vite a `.tsx` fájlokat plugin nélkül,
automatikus JSX runtime-mal fordítja (SPEC-007 M-1, M-2, M-3, saját méréssel igazolva,
`docs/research/2026-09-01-spec007-f0-meresek.md`).

Az alkalmazás **épülőben van**: a SPEC-007 12.2 tizenkét téma mappájából eddig a `frontend-config`
áll, a többit a PLAN-008 F3 ... F5 fázisai adják. A `src/main.ts` és az `index.html` még a
Playwright e2e infrastruktúra vázát szolgálja, amit a T-008-18 lépés cserél le a valódi
belépési pontra.

## Fájlok

| Téma / fájl            | Tartalom                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `src/index.ts`         | barrel, csak nevesített újraexport                                                                                             |
| `src/vite-env.d.ts`    | **típus only** (nincs `.spec.ts` párja): az `import.meta.env` típusbővítése, `import` sor nélkül (SPEC-007 M-11)               |
| `src/frontend-config/` | a kötelező, `VITE_` előtagú konfiguráció beolvasása `Outcome` alakban, **alapérték nélkül**; a hibaüzenet a változó nevét adja |
| `src/main.ts`          | ideiglenes böngésző belépési pont, kizárólag az e2e vázhoz; a T-008-18 lépés cseréli le                                        |
| `index.html`           | a Vite dev/build belépési HTML-je                                                                                              |
| `vite.config.ts`       | Vite 8 config, `vite-plugin-istanbul` a `VITE_COVERAGE=true` mögé rejtve (`requireEnv`)                                        |
| `vitest.config.ts`     | Vitest projekt config, `happy-dom` környezet (SPEC-001 9. szekció)                                                             |
| `playwright.config.ts` | Playwright alap config, `retries: 0` (dokumentált alapértelmezés), `chromium` projekt                                          |
| `e2e/`                 | Playwright tesztek és a coverage fixture                                                                                       |

## Függőségi irány

A `web` a `core`, a `protocol` és az `ui` csomagtól függ, L5 réteg (SPEC-002 4. szekció). **Tilos**
a `db`, az `engine`, az `agent` vagy a `server` csomagtól függenie. Ez megegyezik a
`package.json` tényleges tartalmával. A külső függőségek (`react`, `react-dom`) és a típusaik
(`@types/react`, `@types/react-dom`) katalógus hivatkozással állnak, a verziók forrása a
`docs/research/2026-08-26-toolchain.md`.

## Szabályok

Ha a csomag valódi tartalmat kap, a `src/index.ts` `IS_WEB_PLACEHOLDER` konstansát törölni kell
(megtörtént). A `src/` alatti mappaszerkezet a téma szerinti konvenciót követi, egy szint mélyen;
a `src/` alatt közvetlenül kizárólag az `index.ts` barrel és a `vite-env.d.ts` típus only fájl
állhat (SPEC-002 6.8, SPEC-007 12.2).

**Konfigurációs érték soha nem kerül a kódba.** Nincs port szám, origin literál, lapméret szám és
időkorlát szám a `src/` alatt: mindegyik kötelező `VITE_` előtagú környezeti változó,
alapérték nélkül (SPEC-007 O-4, O-5, O-6, 16. szekció 45. kritérium). A hiányzó változóról szóló
hibaüzenet a változó **nevét** nevezi meg, az értékét soha.

A `tsc --noEmit` (a `typecheck` script) a `src/**/*.ts` és a `src/**/*.tsx` fát fedi. Az `e2e/`
saját `tsconfig.json`-nal rendelkezik (Node környezet, `tooling/tsconfig/node.json` alap), mert
a Playwright tesztek Node alatt futnak, node beépített modulokat importálnak (`node:fs`
stb.), és ez eltér a `src/` böngésző-jellegű (DOM) környezetétől - ezért a `typecheck`
script két `tsc` hívást futtat egymás után. A `vite.config.ts` és a `playwright.config.ts`
egyik tsconfig `include`-jában sincs benne, ezek az ESLint `allowDefaultProject`
mechanizmusán keresztül vannak lintelve (lásd a gyökér `eslint.config.ts` megjegyzését).

Az `e2e/coverage-fixture.ts` `declare global { var __coverage__: unknown }` ambiens
deklarációja szükséges, mert a `page.evaluate()` callback a böngészőben fut, és a
`unicorn/prefer-global-this` szabály miatt `globalThis`-en keresztül kell hivatkozni rá,
nem `window`-n.

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-007-frontend-alkalmazas.md`](../../docs/spec/SPEC-007-frontend-alkalmazas.md)
- [`../../docs/plan/PLAN-008-frontend-alkalmazas.md`](../../docs/plan/PLAN-008-frontend-alkalmazas.md)
- [`../../docs/spec/SPEC-001-monorepo-toolchain.md`](../../docs/spec/SPEC-001-monorepo-toolchain.md), 3. és 10. szekció
- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 4. és 6. szekció (a `src/main.ts` kivétel a 6.8 pontban)
