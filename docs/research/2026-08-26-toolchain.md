# Toolchain kutatás, 2026-08-26

Minden verzió élő npm registry / hivatalos forrás lekérdezésből. Ez a fájl a projekt
verzió-döntéseinek forrása. Ha frissítesz egy csomagot, ide is vezesd át.

## Rögzített verziók

| Csomag                           | Verzió                     | Forrás / megjegyzés                                   |
| -------------------------------- | -------------------------- | ----------------------------------------------------- |
| `@anthropic-ai/claude-agent-sdk` | 0.3.245                    | **pinelve**, lásd lent                                |
| TypeScript                       | **6.0.3**                  | fix, nem frissítjük 7-re                              |
| Bun                              | 1.4.0                      | csak csomagkezelő és workspace                        |
| Node.js                          | 26.7.0                     | runtime, `.nvmrc` = v26.0.0                           |
| Turborepo                        | 2.10.12                    | `tasks` séma, nem `pipeline`                          |
| React                            | 19.2.8                     | nincs React 20                                        |
| Vite                             | 8.2.2                      | Rolldown alapú                                        |
| `@xyflow/react`                  | 12.11.6                    | MIT, React 19 kompatibilis                            |
| `react-window`                   | 2.3.1                      | MIT, React 18/19 kompatibilis, `List`/`Grid` API      |
| `@dagrejs/dagre`                 | 3.1.1                      | MIT, nincs peer dependency                            |
| Vitest                           | 4.1.11                     | v8 coverage provider                                  |
| `@playwright/test`               | 1.62.1                     |                                                       |
| ESLint                           | 10.9.1                     | csak flat config, `.eslintrc` megszűnt                |
| `typescript-eslint`              | 8.68.0                     | peer: `typescript >=4.8.4 <6.1.0`                     |
| `eslint-plugin-unicorn`          | 73.0.0                     | peer: `eslint >=10.4`                                 |
| `eslint-plugin-import-x`         | 4.17.1                     | az `eslint-plugin-import` karbantartott forkja        |
| `eslint-plugin-sonarjs`          | 4.2.0                      | **LGPL-3.0-only**, dev függőség                       |
| Prettier                         | 3.9.6                      | nincs 4.0                                             |
| Drizzle ORM                      | 0.45.2                     | még 0.x                                               |
| `better-sqlite3`                 | 13.0.3                     | natív modul                                           |
| `drizzle-kit`                    | 0.31.10                    | npm `latest`, T-003-2, lásd lent                      |
| `@types/better-sqlite3`          | 9.6.0                      | npm `latest`, T-003-2, lásd lent                      |
| `ws`                             | 8.21.3                     |                                                       |
| `pino` / `pino-roll`             | 10.3.1 / 4.0.0             | log rotation                                          |
| `zod`                            | `^4.0.0` (telepítve 4.4.3) | `packages/protocol` drótszintű séma, T-006, lásd lent |

## `drizzle-kit` és `@types/better-sqlite3` verzió, 2026-08-27 (T-003-2, SPEC-003)

Élő npm registry lekérdezés, két független forrással mindkét csomagra:

| Csomag                  | Verzió    | Forrás 1                                                           | Forrás 2                                                                  |
| ----------------------- | --------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `drizzle-kit`           | `0.31.10` | https://registry.npmjs.org/drizzle-kit/latest (`dist-tags.latest`) | https://unpkg.com/drizzle-kit/package.json (301 -> `drizzle-kit@0.31.10`) |
| `@types/better-sqlite3` | `9.6.0`   | https://registry.npmjs.org/@types/better-sqlite3/latest            | https://unpkg.com/@types/better-sqlite3/package.json (301 -> `@9.6.0`)    |

Mindkét lekérdezés ugyanazt a verziót adta a két forrásból, tippelés nem történt. A
`drizzle-kit` saját `devDependencies` bejegyzése a `@types/better-sqlite3@^7.6.13` és a
`better-sqlite3@^11.9.1` sort tartalmazza a fejlesztéséhez, ez a projekt saját
`better-sqlite3@13.0.3` és `@types/better-sqlite3@9.6.0` választását nem befolyásolja, mert
ezek a `drizzle-kit` CLI belső build függőségei, nem futásidejű peer követelmény a
felhasználó felé.

## `zod` verzió, 2026-08-29 (T-006, SPEC-005)

Élő npm registry lekérdezés, két független forrással:

| Csomag | Verzió (npm `latest`) | Forrás 1                                          | Forrás 2                                                |
| ------ | --------------------- | ------------------------------------------------- | ------------------------------------------------------- |
| `zod`  | `4.5.2`               | https://registry.npmjs.org/zod/latest (`version`) | https://unpkg.com/zod/package.json (302 -> `zod@4.5.2`) |

A `packages/protocol/package.json` a `zod` csomagot `^4.0.0` range-en deklarálja, ami a
workspace fában **már meglévő** kényszer: az `@anthropic-ai/claude-agent-sdk` `peerDependencies`
mezője `zod: "^4.0.0"`, a `@modelcontextprotocol/sdk` `zod: "^3.25 || ^4.0"`, az
`@anthropic-ai/sdk` `zod: "^3.25.0 || ^4.0.0"` értéket követeli. A `^4.0.0` tehát nem új
verziódöntés, hanem a fában már meglévő négy hely közös metszete (SPEC-005 3.4, 6.). A
telepített, `bun.lock`-ban rögzített tényleges verzió `4.4.3` (a `^4.0.0` range-nek megfelel), nem
a legfrissebb `4.5.2`, mert a projekt a lockfile-ban rögzített verziót használja, és a frissítés
külön, forrásolt lépés (SPEC-005 6. táblázat, "A `zod` verzió frissül..." sor).

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

## React és táblamotor verziók, 2026-09-01 (T-008-6, PLAN-008 F0)

Élő npm registry lekérdezés, két független forrással mindegyikre (a `react` már korábban
rögzítve, `19.2.8`, változatlan).

| Csomag                  | Verzió    | Forrás 1                                                  | Forrás 2                                                                 |
| ----------------------- | --------- | --------------------------------------------------------- | ------------------------------------------------------------------------ |
| `react-dom`             | `19.2.8`  | `https://registry.npmjs.org/react-dom/latest` (`version`) | `https://unpkg.com/react-dom/package.json` (301 -> `react-dom@19.2.8`)   |
| `@types/react`          | `19.2.18` | `https://registry.npmjs.org/@types/react/latest`          | `https://unpkg.com/@types/react/package.json` (301 -> `@19.2.18`)        |
| `@types/react-dom`      | `19.2.5`  | `https://registry.npmjs.org/@types/react-dom/latest`      | `https://unpkg.com/@types/react-dom/package.json` (301 -> `@19.2.5`)     |
| `@tanstack/react-table` | `9.2.4`   | `https://registry.npmjs.org/@tanstack/react-table/latest` | `https://unpkg.com/@tanstack/react-table/package.json` (301 -> `@9.2.4`) |

A `@tanstack/react-table` `9.2.4` a döntés a `data-table` téma motorjára (SPEC-007 O-2, lásd
`docs/research/2026-09-01-spec007-f0-meresek.md`): a mérés szerint mindkét verzió (`8.21.3` és
`9.2.4`) ténylegesen renderel React 19.2.8 alatt, de a `9.2.4` az npm `latest`, stabil kiadás
(`prerelease: false`), a `8.21.3` pedig csak a régi, deprecated `useLegacyTable` kompatibilitási
rétegen át lenne portolható. A projekt szabálya szerint új kódot nem építünk deprecated API-ra,
ezért a `9.2.4` natív (`useTable` + `tableFeatures`) API-ja a választás.

## Gráf elrendező könyvtár verzió, 2026-09-05 (SPEC-008 O-6)

Élő npm registry lekérdezés, két független forrással. A választás indoklása, a licenc
olvasás, a React 19 verdikt és a dokumentált alapértelmezett távolságok a
`docs/research/2026-09-05-grafszerkeszto-es-transcript.md` 6. szekciójában állnak.

| Csomag           | Verzió  | Forrás 1                                           | Forrás 2                                              |
| ---------------- | ------- | -------------------------------------------------- | ----------------------------------------------------- |
| `@dagrejs/dagre` | `3.1.1` | `https://registry.npmjs.org/@dagrejs/dagre/latest` | `https://unpkg.com/@dagrejs/dagre@3.1.1/package.json` |

A csomag licence `MIT`, `peerDependencies` mezője nincs (tehát React peer range-et nem
deklarál, és a projekt `react@19.2.8` verziójával nincs mit ütköztetni), egyetlen
futásidejű függősége a `@dagrejs/graphlib@4.0.5`, a típusdefiníciót maga szállítja
(`./dist/types/index.d.ts`), tehát `@types/dagre` nem kell. A `dagrejs` fork a választás
az eredeti `dagre` csomag helyett: az utóbbi utolsó kiadása `0.8.5`, `2019-12-03`, míg a
fork `3.1.1` kiadása `2026-08-08`, és a hivatalos React Flow layouting oldal is a
`dagrejs` szervezet repójára és wikijére mutat.

## `@xyflow/react`, `react-window` verzió pontosítás, 2026-09-05 (PLAN-009 T-009-2, T-009-4)

A F0 blokkoló mérések megismételték az élő registry lekérdezést a ténylegesen rögzítendő
verziókra (`docs/research/2026-09-05-plan009-f0-blokkolo-meresek.md` 1. és 3. szekció).

| Csomag          | Verzió    | Forrás 1                                                               | Forrás 2                                                                                            |
| --------------- | --------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `@xyflow/react` | `12.11.6` | `https://registry.npmjs.org/@xyflow/react/latest` (`dist-tags.latest`) | `https://unpkg.com/@xyflow/react@12.11.6/package.json`, plusz a GitHub release `2026-09-01`         |
| `react-window`  | `2.3.1`   | `https://registry.npmjs.org/react-window/latest` (`dist-tags.latest`)  | `https://unpkg.com/react-window@2.3.1/package.json`, plusz a GitHub tag lista (`2.3.1` legfrissebb) |

A `2026-09-05-grafszerkeszto-es-transcript.md` kutatás még `@xyflow/react@12.11.5`-öt és
`react-window@2.3.0`-t mért; a fenti két sor a ténylegesen a katalógusba és a
`bun.lock`-ba kerülő verziót rögzíti. Egyik csomag `peerDependencies` mezője, licence és
DOM/API alakja sem változott a mért patch verzióhoz képest.

## GitHub Actions verziók

| Action                      | Verzió |
| --------------------------- | ------ |
| `actions/checkout`          | v7.0.1 |
| `actions/setup-node`        | v7.0.0 |
| `oven-sh/setup-bun`         | v2.2.0 |
| `actions/cache`             | v6.1.0 |
| `actions/upload-artifact`   | v7.0.1 |
| `actions/download-artifact` | v8.0.1 |
