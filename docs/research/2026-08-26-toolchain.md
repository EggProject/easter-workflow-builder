# Toolchain kutatás, 2026-08-26

Minden verzió élő npm registry / hivatalos forrás lekérdezésből. Ez a fájl a projekt
verzió-döntéseinek forrása. Ha frissítesz egy csomagot, ide is vezesd át.

## Rögzített verziók

| Csomag                           | Verzió         | Forrás / megjegyzés                            |
| -------------------------------- | -------------- | ---------------------------------------------- |
| `@anthropic-ai/claude-agent-sdk` | 0.3.245        | **pinelve**, lásd lent                         |
| TypeScript                       | **6.0.3**      | fix, nem frissítjük 7-re                       |
| Bun                              | 1.4.0          | csak csomagkezelő és workspace                 |
| Node.js                          | 26.7.0         | runtime, `.nvmrc` = v26.0.0                    |
| Turborepo                        | 2.10.12        | `tasks` séma, nem `pipeline`                   |
| React                            | 19.2.8         | nincs React 20                                 |
| Vite                             | 8.2.2          | Rolldown alapú                                 |
| `@xyflow/react`                  | 12.11.5        | MIT, React 19 kompatibilis                     |
| Vitest                           | 4.1.11         | v8 coverage provider                           |
| `@playwright/test`               | 1.62.1         |                                                |
| ESLint                           | 10.9.1         | csak flat config, `.eslintrc` megszűnt         |
| `typescript-eslint`              | 8.68.0         | peer: `typescript >=4.8.4 <6.1.0`              |
| `eslint-plugin-unicorn`          | 73.0.0         | peer: `eslint >=10.4`                          |
| `eslint-plugin-import-x`         | 4.17.1         | az `eslint-plugin-import` karbantartott forkja |
| `eslint-plugin-sonarjs`          | 4.2.0          | **LGPL-3.0-only**, dev függőség                |
| Prettier                         | 3.9.6          | nincs 4.0                                      |
| Drizzle ORM                      | 0.45.2         | még 0.x                                        |
| `better-sqlite3`                 | 13.0.3         | natív modul                                    |
| `ws`                             | 8.21.3         |                                                |
| `pino` / `pino-roll`             | 10.3.1 / 4.0.0 | log rotation                                   |

## Miért TypeScript 6.0.3 és nem 7

- A TS 7.0.2 a jelenlegi npm `latest` (Go-alapú natív fordító, 2026-07-08).
- A `typescript-eslint@8.68.0` peer range-e `>=4.8.4 <6.1.0`, és a legfrissebb canary
  (`8.68.1-alpha.3`) is ugyanez. Nincs v9 alpha.
- A TS 7 támogatási issue lezárva "not planned" státusszal, mert a TS 7-ben nincs stabil
  programozott compiler API. Ígéret szerint 7.1 (2026 ősz) hozza.
  https://github.com/typescript-eslint/typescript-eslint/issues/12518
- TS 7 + typescript-eslint: `npm ci` ERESOLVE, kikényszerítve runtime crash.
- A **6.1 sosem jelent meg**, a 6.0.3 (2026-04-16) a legfrissebb 6.x. A user döntése
  szerint a "mindig a legújabb" szabály erre a csomagra nem vonatkozik.

## TypeScript 6.0 új alapértelmezések (breaking)

`strict: true`, `module: esnext`, `target` = legújabb ES, `types: []`,
`noUncheckedSideEffectImports: true`, `libReplacement: false`, `rootDir` = tsconfig könyvtára.
Eltávolítva/deprecated: `target: es5`, `downlevelIteration`, `moduleResolution: node|node10|classic`,
`module: amd|umd|systemjs`, `baseUrl`, `esModuleInterop: false`, `alwaysStrict: false`, `outFile`.
Migrációs segéd: `--ts6-migration`, átmeneti `"ignoreDeprecations": "6.0"`.
Az `erasableSyntaxOnly`, `verbatimModuleSyntax`, `isolatedDeclarations` **nem** lett
alapértelmezett 6.0-ban, opt-in maradt.
Forrás: https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/

## Miért Bun csak csomagkezelő, és Node a runtime

- Vitest 4 Bun runtime alatt nem hivatalosan támogatott, a Bun tracking issue nyitva:
  https://github.com/oven-sh/bun/issues/4145
- A v8 coverage provider `node:inspector`-t igényel, ami Bunban hiányzik:
  https://github.com/oven-sh/bun/issues/2445
- `bun:` prefixű modul (pl. `bun:sqlite`) Node ESM loaderből nem importálható.
- Következmény: **tilos `bun:` prefixű modult használni a termékkódban.**
  A WebSocket réteg `ws`, az SQLite driver `better-sqlite3`.
- Vitest futtatása Bun alól: `bun run vitest`, soha nem `bun test` (az a Bun saját runnere).
- A `bun.lock` (JSONC, szöveges) az alapértelmezett lockfile, nem a bináris `bun.lockb`.

## Egyéb rögzített döntések

- **Nincs Docker.** Az agent-sandboxolást az SDK beépített `sandbox` opciója adja
  (macOS: Seatbelt, Linux: bubblewrap). Nincs `.dockerignore`, nincs image build job.
- Playwright nem támogat musl-t, de ez már nem releváns Docker nélkül.
- E2E coverage: `vite-plugin-istanbul` instrumentálás + `window.__coverage__` mentés
  Playwrightból. A Playwrightnak nincs beépített coverage funkciója.

## GitHub Actions verziók

| Action                      | Verzió |
| --------------------------- | ------ |
| `actions/checkout`          | v7.0.1 |
| `actions/setup-node`        | v7.0.0 |
| `oven-sh/setup-bun`         | v2.2.0 |
| `actions/cache`             | v6.1.0 |
| `actions/upload-artifact`   | v7.0.1 |
| `actions/download-artifact` | v8.0.1 |
