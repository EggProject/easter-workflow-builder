# easter-workflow-builder

Vizuális workflow tervező és futtató a `@anthropic-ai/claude-agent-sdk` felett. A gráf szerkesztőben
összerakott workflow-t el lehet indítani, és a rajzon real time látszik, hol tart; mellette egy
transcript panel mutatja, mit csinál az agent. A projekt szabályai a `.claude/CLAUDE.md` fájlban
élnek, a részletes döntések a `docs/spec/` és a `docs/research/` mappában.

## Előfeltételek

- **Node** és **Bun**, a rögzített verziókkal: a verziók egyetlen forrása a
  `docs/research/2026-08-26-toolchain.md` fájl (a gyökér `package.json` `devEngines` mezője a Bun
  verziót is rögzíti). A Bun csak csomagkezelő és workspace, a szerver Node alatt fut.
- A `claude-subscription` provider használatához bejelentkezett **Claude Code** (`/login`).
- A `minimax` provider használatához egy MiniMax kulcs (lásd lent).

## Telepítés

```sh
bun install --frozen-lockfile
cp .env.example .env
cp apps/web/.env.example apps/web/.env
```

A két `.env` fájl kizárt a gitből, titok csak oda kerül. A minták értéke egyezik a kódbeli
alapértékkel, tehát a másolás nélkül is ugyanezek érvényesek (lásd "Alapértékek és felülírásuk"),
egyetlen kivétellel: az `EASTER_SKILL_LIBRARY_DIRECTORY` kötelező, ezért a szerver a `.env` másolása
nélkül (vagy az érték megadása nélkül) nem indul.

**Ha a `.env` fájlodban a `MINIMAX_API_KEY` sor áll, nevezd át `ANTHROPIC_AUTH_TOKEN`-re vagy
`ANTHROPIC_API_KEY`-re.** A MiniMax kulcs e két név bármelyikén érkezhet a szerverhez (SPEC-013 4.1); a
régi nevet a szerver már nem olvassa.

## Indítás (két terminál)

```sh
# 1. terminál: a szerver (build nélkül, a repo gyökeréből)
bun run start:server

# 2. terminál: a web (Vite dev szerver)
bun run dev:web
```

Utána a böngészőben: <http://localhost:5173>. A `127.0.0.1:5173` cím más origin, arra a szerver nem
ad CORS engedélyt, ezért ne azt használd.

| Script                 | Mit csinál                                                                                                                                                                  |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run start:server` | `node --env-file-if-exists=.env apps/server/src/main.ts`: a szerver build nélkül indul; a `.env` hiánya nem hiba, és a környezetben álló változó nyer a fájlbelivel szemben |
| `bun run dev:server`   | ugyanez `node --watch` alatt: a szerver forrás, a workspace csomagok forrása és az env fájl változására újraindul                                                           |
| `bun run dev:web`      | a Vite dev szerver az `apps/web` csomagban; az `apps/web/.env` fájlt maga tölti, a REST hívásokat a `/api` proxyn át a szerverre küldi                                      |

A `dev:server` újraindítása egy **futó lépéssel nem mért**: fejlesztői kényelem, a stabil út a
`start:server`. A scriptek szándékosan nem a Turborepo alatt futnak, mert annak `strict` env módja
csendben szűkítené a szerver környezetét.

## Alapértékek és felülírásuk

Minden konfigurációs értéknek van alapértéke a kódban, egyetlen kivétellel (lásd lent: a skill
könyvtár útvonala); az env változó hiányában (nincs beállítva, vagy üres) az érvényes, a megadott érvénytelen érték viszont hiba, nem csendes visszaesés (SPEC-012 4.2). A
források a `docs/research/2026-10-26-helyi-inditas-es-valodi-proba.md` fájlban.

| Változó                                | Alapérték               | Megjegyzés                                                                                  |
| -------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------- |
| `EASTER_SERVER_PORT`                   | `3001`                  | a szerver a `127.0.0.1` címre köt                                                           |
| `EASTER_STREAM_KEEP_ALIVE_INTERVAL_MS` | `15000`                 | az SSE életben tartó jelzés gyakorisága                                                     |
| `EASTER_LOG_DIRECTORY`                 | `.data/logs/server`     | **fájl útvonal előtag, nem könyvtár**: a napló a `.data/logs/server.1.log` fájlba kerül     |
| `EASTER_LOG_ROTATION_SIZE`             | `10m`                   | 10 MiB                                                                                      |
| `EASTER_LOG_ROTATION_FREQUENCY`        | `604800000`             | 7 nap ezredmásodpercben (UTC csütörtök 00:00 határ); a `daily` és `hourly` név is megadható |
| `EASTER_LOG_RETAINED_FILE_COUNT`       | `4`                     | forgatott példányok az aktív fájlon felül, a teljes könyvtárra                              |
| `EASTER_SKILL_MAX_ARCHIVE_BYTES`       | `30000000`              | a feltöltött skill ZIP csomag legnagyobb mérete bájtban (pozitív egész)                     |
| `EASTER_SKILL_MAX_UNPACKED_BYTES`      | `30000000`              | a kicsomagolt skill fájlok legnagyobb összmérete bájtban (pozitív egész)                    |
| `EASTER_SKILL_MAX_ENTRY_COUNT`         | `1024`                  | a skill ZIP csomag bejegyzéseinek legnagyobb száma (pozitív egész)                          |
| `VITE_API_ORIGIN`                      | `http://localhost:5173` | a REST hívások origin je (a Vite dev szerver, `/api` proxy)                                 |
| `VITE_STREAM_ORIGIN`                   | `http://127.0.0.1:3001` | az SSE csatorna és a proxy célja                                                            |
| `VITE_LIST_LIMIT`                      | `100`                   | a lista végpontok lapmérete; **100 fölött a lista levágódik**, lapozás nincs                |
| `VITE_STREAM_REPLAY_LIMIT`             | `100`                   | a stream visszajátszás lapmérete, nem plafon                                                |

**Kötelező, alapérték nélkül: `EASTER_SKILL_LIBRARY_DIRECTORY`** a feltöltött skillek könyvtára
(SPEC-009 5.1); hiányában vagy üres értékénél a szerver nem indul. A `.env.example` mintában
`.data/skills` áll, tehát a `cp .env.example .env` után a szerver indul. Hogy ez a kivétel marad-e
(vagy a könyvtár forrásolt alapértéket kap), a SPEC-012 4.2 és a SPEC-009 5.1 ütközése miatt
user döntésre vár (SPEC-009 O-49).

Opcionális, alapérték nélkül: `EASTER_STREAM_DEV_ORIGIN` (hiányában a szerver nem küld CORS
fejlécet; a minta `http://localhost:5173`), `EASTER_DB_FILE` (hiányában
`.data/easter-workflow-builder.sqlite`) és `EASTER_LOG_LEVEL` (hiányában a `pino` alapértéke).

## Providerek

- **`claude-subscription`**: nem kér env változót, a Claude Code `/login` bejelentkezését használja.
  A szerver környezetében álló, hitelesítést felülíró változók (köztük az `ANTHROPIC_AUTH_TOKEN` és az
  `ANTHROPIC_API_KEY`) nem jutnak el ehhez a lépéshez.
- **`minimax`** (modell: `MiniMax-M3.1-Flash`): a kulcs az `ANTHROPIC_AUTH_TOKEN` vagy az
  `ANTHROPIC_API_KEY` változóból jön, a `.env` fájlból vagy a környezetből; ha mindkettő áll, az
  `ANTHROPIC_AUTH_TOKEN` nyer, és a lépés felé a kulcs mindig `ANTHROPIC_AUTH_TOKEN` néven megy ki
  (SPEC-013 4.). **Figyelem:** egy `ANTHROPIC_API_KEY` néven tárolt Anthropic kulcs is a MiniMaxhoz
  menne, ha `ANTHROPIC_AUTH_TOKEN` nincs beállítva (SPEC-013 9.). A kulcsot soha ne írd a
  `.env.example` fájlba vagy a gitbe.

**A szerver környezete az agenté is.** A lépés alfolyamata a szerver teljes környezetét örökli (a
`PATH`, a `HOME` és a többi változó átmegy), a saját provider kulcsával kiegészítve, a másik provider
titkai és a hitelesítést átirányító változók nélkül. Egy lépés eszközei (például a `Bash`) ezért a
szerver környezetének többi változóját is látják; ne tegyél a szerver környezetébe olyan titkot, amit az
agentnek nem szabad látnia.

## Valódi provider próba

`bun run probe:real-provider -- <providerId>` (`minimax` vagy `claude-subscription`) egy kézzel
indítható eszköz az `apps/server/measurement/` mappában: saját szervert indít ideiglenes adatbázissal
és naplóval, lefuttat egy minimális `agent_step` workflow-t (`maxTurns: 1`), és csak az összegzést
írja ki. **Valódi tokenbe kerül**, költségkeret és időkorlát nélkül (a megszakítás a te dolgod,
`Ctrl-C`), ezért csak szándékosan indítsd. Nem tagja a kapuknak és nem fut a CI-ban. Részletek:
`docs/spec/SPEC-012-helyi-inditas-es-valodi-proba.md` 5. szekció.

## Minőségi kapuk

A commit előtt mind a kilenc parancs nulla kilépési kóddal fut: `bun run format:check`,
`typecheck`, `lint`, `test`, `build`, `docs:check`, `check:casing`, `check:graph`,
`check:db-drift` (a lista egyetlen forrása a `.claude/CLAUDE.md` 8. szekciója). A Vitest futtatása
`bun run test`, soha nem `bun test`; `npm` és `npx` nem használható.
