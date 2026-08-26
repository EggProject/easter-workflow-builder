# apps/web

## Mi ez a mappa

React 19 és Vite 8 frontend. **Jelenleg üres váz**, a `src/index.ts` csak egy placeholder
export, hogy a csomag lefordulhasson. A tényleges alkalmazás egy későbbi specifikáció
tárgya, a `tooling/tsconfig/react.json`-t használja (JSX runtime).

A `vite.config.ts`, az `index.html` és a `src/main.ts` NEM a tényleges alkalmazás része -
ezek kizárólag a Playwright e2e teszt infrastruktúra vázához kellenek (SPEC-001 10.
szekció): legyen mit kiszolgálnia a `webServer`-nek, és legyen min kipróbálni a
`vite-plugin-istanbul` instrumentálást valódi build/serve folyamaton. Ezt egy későbbi
spec lecseréli a valódi UI-ra.

## Fájlok

| Fájl                   | Tartalom                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------- |
| `src/index.ts`         | placeholder export, csak hogy a csomag lefordulhasson                                   |
| `src/main.ts`          | ideiglenes böngésző belépési pont, kizárólag az e2e vázhoz (lásd fent)                  |
| `index.html`           | a Vite dev/build belépési HTML-je, a `src/main.ts`-re mutat                             |
| `vite.config.ts`       | Vite 8 config, `vite-plugin-istanbul` a `VITE_COVERAGE=true` mögé rejtve (`requireEnv`) |
| `vitest.config.ts`     | Vitest projekt config, `happy-dom` környezet (SPEC-001 9. szekció)                      |
| `playwright.config.ts` | Playwright alap config, `retries: 0` (dokumentált alapértelmezés), `chromium` projekt   |
| `e2e/`                 | Playwright tesztek és a coverage fixture, lásd `e2e/CLAUDE.md`                          |

## Függőségi irány

A `web` a `core`, a `protocol` és az `ui` csomagtól függhet. **Tilos** a `db`, az
`engine`, az `agent` vagy a `server` csomagtól függenie.

## Szabályok

A `tsc --noEmit` (a `typecheck` script) csak a `src/**/*.ts` fát fedi. Az `e2e/` saját
`tsconfig.json`-nal rendelkezik (Node környezet, `tooling/tsconfig/node.json` alap), mert
a Playwright tesztek Node alatt futnak, node beépített modulokat importálnak (`node:fs`
stb.), és ez eltér a `src/` böngésző-jellegű (DOM) környezetétől - ezért a `typecheck`
script két `tsc` hívást futtat egymás után. A `vite.config.ts` és a `playwright.config.ts`
egyik tsconfig `include`-jában sincs benne, ezek az ESLint `allowDefaultProject`
mechanizmusán keresztül vannak lintelve (lásd a gyökér `eslint.config.ts` megjegyzését).

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-001-monorepo-toolchain.md`](../../docs/spec/SPEC-001-monorepo-toolchain.md), 3. és 10. szekció
