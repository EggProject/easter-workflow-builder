# apps/web

## Mi ez a mappa

A React 19 és Vite 8 frontend alkalmazás (SPEC-007). A `packages/ui` átemelt komponenseit
fogyasztja, a drótszintű típusokat és Zod sémákat pedig kizárólag a `packages/protocol`
barreljéből veszi: saját drótszintű típus vagy séma a `src/` alatt nem állhat (SPEC-007 3.1).
A `@vitejs/plugin-react` csomag **sehol nem szerepel**: a Vite a `.tsx` fájlokat plugin nélkül,
automatikus JSX runtime-mal fordítja (SPEC-007 M-1, M-2, M-3, saját méréssel igazolva,
`docs/research/2026-09-01-spec007-f0-meresek.md`).

A SPEC-007 12.2 tizenkét téma mappája mind megvan: `app-mount`, `app-shell`, `client-route`,
`frontend-config`, `history-navigation`, `not-found-route`, `protocol-error-message`,
`request-state`, `rest-client`, `run-history`, `stream-client`, `workflow-list`. A valódi belépési
pont a `src/app-mount/main.tsx`, amit az `index.html` modul scriptje tölt be; a `src/main.ts`
ideiglenes e2e-váz megszűnt.

A tizenkettőn felül három további, megvalósítás nélküli, greppel ellenőrizhető invariáns téma
mappa is van: `greppable-invariants` (T-008-31, tizenharmadik), `vite-istanbul-include-invariant`
(T-008-18, tizennegyedik) és `e2e-coverage-threshold` (tizenötödik, 2026-09-05). Ezek a
`packages/ui`-ban már bevett minta (`aria-token-list`,
`class-name-list`, `component-boundary-invariant`, `media-query-breakpoint-invariant`) analógjai:
egyik sem a SPEC-007 12.2 UI témái közé tartozik, hanem a SPEC-002 6.2 5. pontja szerinti
konfigurációs invariáns saját mappában.

## Fájlok

| Téma / fájl                            | Tartalom                                                                                                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/index.ts`                         | barrel, csak nevesített újraexport                                                                                                                                             |
| `src/vite-env.d.ts`                    | **típus only** (nincs `.spec.ts` párja): az `import.meta.env` típusbővítése, `import` sor nélkül (SPEC-007 M-11)                                                               |
| `src/app-mount/`                       | a valódi böngésző belépési pont: `main.tsx` (egy import, egy hívás) és `mount-app.tsx`, ami a `#root` hiányát és a hibás konfigurációt kezeli (SPEC-007 12.2)                  |
| `src/app-shell/`                       | a topnav összeállítása: brand, navigáció, lenyíló menü, stream státusz kijelző (SPEC-007 12.2)                                                                                 |
| `src/frontend-config/`                 | a kötelező, `VITE_` előtagú konfiguráció beolvasása `Outcome` alakban, **alapérték nélkül**; a hibaüzenet a változó nevét adja                                                 |
| `src/client-route/`                    | a kliens oldali útvonaltábla (`workflowList`, `runHistory`) és a `pathname -> routeId` illesztő (SPEC-007 7.2, 12.2)                                                           |
| `src/history-navigation/`              | a `history`/`location` böngésző API befecskendezett portja, böngésző megvalósítás és a `useClientRoute` hook (SPEC-007 7.2, 9.1)                                               |
| `src/not-found-route/`                 | az ismeretlen útvonal képernyője (SPEC-007 12.2)                                                                                                                               |
| `src/protocol-error-message/`          | a `ProtocolErrorCode` magyar üzenet leképezése (SPEC-007 8.4)                                                                                                                  |
| `src/request-state/`                   | négyállapotú (`idle`/`pending`/`success`/`failure`) async állapot típus és a `useRequestState` hook (SPEC-007 11. szekció)                                                     |
| `src/rest-client/`                     | REST hívás a `packages/protocol` `ROUTE_TABLE` fölött, befecskendezett `FetchFunction`-nel, öt `Outcome` hibaággal (SPEC-007 8. szekció)                                       |
| `src/run-history/`                     | a futás előzmények képernyő, fülekkel és élő állapot feliratkozással, plusz a státusz-jelvény leképezés (SPEC-007 10.2)                                                        |
| `src/stream-client/`                   | `EventSourceFactory` és `streamId` generátor port, az öt SSE keret feldolgozása, a topnav státusz négy fázisa (SPEC-007 9. szekció)                                            |
| `src/workflow-list/`                   | a workflow lista képernyő és a három soronkénti modális (létrehozás, átnevezés, törlés-hatás-összegzés) (SPEC-007 10.1)                                                        |
| `src/greppable-invariants/`            | tizenkét, megvalósítás nélküli, greppel ellenőrizhető invariáns teszt egy `describe` blokkban (T-008-31, SPEC-002 6.2 5. pont mintája)                                         |
| `src/vite-istanbul-include-invariant/` | megvalósítás fájl nélküli téma: regressziós teszt, ami a `vite.config.ts` istanbul `include` mintázatát `'src/**/*'` alakon rögzíti, nem `'src/*'` (T-008-18)                  |
| `src/e2e-coverage-threshold/`          | megvalósítás fájl nélküli téma: regressziós teszt, ami az e2e lefedettségi küszöb **kapu jellegét** őrzi (`--check-coverage` a scriptben, `e2e` a `ci` job `needs` listájában) |
| `index.html`                           | a Vite dev/build belépési HTML-je, a `src/app-mount/main.tsx`-re mutat, `<meta name="viewport">` a valódi mobil reszponzivitáshoz                                              |
| `vite.config.ts`                       | Vite 8 config, `vite-plugin-istanbul` a `VITE_COVERAGE=true` mögé rejtve (`requireEnv`)                                                                                        |
| `vitest.config.ts`                     | Vitest projekt config, `happy-dom` környezet (SPEC-001 9. szekció)                                                                                                             |
| `vitest.setup.ts`                      | a React 19 `act()` környezet jelzése és a happy-dom projekt-környezetben hiányzó `globalThis.localStorage` pótlása (a `packages/ui` azonos fájljának párja)                    |
| `playwright.config.ts`                 | Playwright alap config, `retries: 0` (dokumentált alapértelmezés), `chromium` projekt                                                                                          |
| `e2e/`                                 | Playwright tesztek, a coverage fixture és a közös REST/SSE mockolási segédfüggvények (T-008-27..29)                                                                            |

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

**Az e2e lefedettségnek kikényszerített küszöbe van** (2026-09-05, felhasználói döntés). A
`coverage:e2e:report` script `--check-coverage` kapcsolóval fut, mind a négy metrikára; a
küszöb alatt az `nyc` nem nulla kilépési kódot ad, ettől a CI `e2e` jobja, azon keresztül pedig
az összesítő `ci` job is elbukik. A négy szám **mért** érték, felfelé kerekítés nélkül (ratchet);
a származtatás, a nem fedett részek tételes indoklása és a "nulla fájl kizárás" döntés a
`docs/research/2026-09-05-e2e-lefedettsegi-kuszob.md` fájlban áll. Ha egy változtatás e2e-vel
nem elérhető ágat vezet be, a küszöböt **lefelé** módosítani csak új mérés és a research fájl
frissítése után szabad.

Az `e2e/sse-real-server.spec.ts` az **egyetlen** spec fájl, ami valódi hálózati szervert indít, és
ez nem bővíthető második fájlra: a szerver a build időben rögzített `VITE_API_ORIGIN` portjára
kötődik, amit egyszerre csak egy teszt tarthat, ezért a fájl `test.describe.configure({ mode:
'serial' })` beállítást kap, és a `server.close()` mellett `server.closeAllConnections()` hívást
is (különben a nyitva hagyott SSE kapcsolat `EADDRINUSE` hibát okoz a következő tesztnél).

Az `e2e/coverage-fixture.ts` `declare global { var __coverage__: unknown }` ambiens
deklarációja szükséges, mert a `page.evaluate()` callback a böngészőben fut, és a
`unicorn/prefer-global-this` szabály miatt `globalThis`-en keresztül kell hivatkozni rá,
nem `window`-n.

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-007-frontend-alkalmazas.md`](../../docs/spec/SPEC-007-frontend-alkalmazas.md)
- [`../../docs/plan/PLAN-008-frontend-alkalmazas.md`](../../docs/plan/PLAN-008-frontend-alkalmazas.md)
- [`../../docs/spec/SPEC-001-monorepo-toolchain.md`](../../docs/spec/SPEC-001-monorepo-toolchain.md), 3. és 10. szekció
- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 4. és 6. szekció (a `src/vite-env.d.ts` kivétel a 6.8 pontban)
