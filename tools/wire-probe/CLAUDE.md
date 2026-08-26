# tools/wire-probe

## Mi ez a mappa

A SPEC-000 (`docs/spec/SPEC-000-provider-wire-measurement.md`) mérőeszköze: egy logoló
reverse proxy és egy mérési harness a `minimax` provider drótszintű viselkedésének
felderítéséhez. Két külön dolog van itt, mert két külön felelősség:

- **A proxy** (`src/proxy.ts`) egy loopback HTTP szerver, amit `ANTHROPIC_BASE_URL`-nek
  állítunk be. Mindent továbbít az upstreamre (`https://api.minimax.io/anthropic`
  alapértelmezésként), bájtszinten, útvonal-fehérlista nélkül, és minden tranzakciót
  maszkolva rögzít.
- **A harness** (`src/probe.ts` + `src/cases/`) az Agent SDK `query()`-jét hívja a
  SPEC-000 4. szekciójában felsorolt mérési esetek szerint (M-01 ... M-36), a proxyn
  keresztül, hogy a tényleges HTTP forgalom rögzüljön.

Ide **nem** tartozik semelyik esetnek a konkrét logikája (`src/cases/`), a proxy vagy a
harness belső rétegének megvalósítása (`src/proxy/`, `src/harness/`) - azok saját
`CLAUDE.md`-vel dokumentáltak. Nem termékkód: a gyökér workspace tagja (`tools/*` glob),
de a `packages/*` fától teljesen független, a SPEC-001 3. szekció csomagtérképe nem is
sorolja fel.

## Fájlok

| Fájl                                  | Tartalom                                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------------------------ |
| `package.json`                        | csomag manifeszt: `proxy`/`probe`/`summary`/`typecheck`/`lint` script, nincs `test` script |
| `tsconfig.json`                       | a `tooling/tsconfig/node.json` kiterjesztése                                               |
| `src/proxy.ts`                        | a proxy belépési pontja (CLI: `bun run proxy`)                                             |
| `src/probe.ts`                        | a harness belépési pontja (CLI: `bun run probe <eset...>`)                                 |
| `src/summary.ts`                      | token-takarékos összefoglaló script (CLI: `bun run summary`)                               |
| `src/no-shadowed-path-import.test.ts` | regressziós Vitest teszt, lásd Szabályok                                                   |

Az `src/proxy/`, `src/harness/` és `src/cases/` alkönyvtár saját `CLAUDE.md`-vel
dokumentált, lásd ott a fájllistát és a függőségi irányt.

## Függőségi irány

Mitől függhet: a `tooling/tsconfig` csomagtól (a `tsconfig.json` a `node.json`-t
terjeszti ki), és a saját `package.json`-jában önállóan pinelt függőségektől
(`@anthropic-ai/claude-agent-sdk`, `zod` - a pontos verziószám nem itt, hanem a
`docs/research/2026-08-26-toolchain.md` fájlban van, lásd Szabályok).

Mitől tilos függenie: bármely `packages/*` csomagtól. Nem termékkód, nem fogyaszt
domain típust, a SPEC-001 3. szekció megengedett függőségi iránya nem is sorolja fel
ebben a fában.

Ki függhet tőle: senki a workspace-ből. A `typecheck` és a `lint` taskja a Turborepo
gráf tagja, de más csomag nem importál innen semmit.

## Szabályok

- A projekt szigorú TypeScript szabályai (`strict`, nincs `any`, nincs `as`, valódi
  `#private` mező) erre a mappára is vonatkoznak, annak ellenére, hogy nem termékkód.
- Nincs `test` npm script, tehát a mérések (`probe`/`proxy`/`summary`, valós API hívást
  tesznek) nem futnak a Turborepo `test` taskján keresztül CI-ben, és a CI nem is kap
  MiniMax API kulcsot.
- **Kivétel: `src/no-shadowed-path-import.test.ts`.** Ez az egyetlen Vitest teszt a
  csomagban - regressziós teszt egy korábban talált valós bugra (két mérési eset fájlban
  egy helyi `const path = ...` eltakarta a `node:path` importot, temporal dead zone
  `ReferenceError` kockázatával). A gyökér `vitest.config.ts` a
  `tools/wire-probe/src/**/*.test.ts` mintát explicit projektként veszi fel a Vitest
  "Test Projects" mechanizmusán keresztül, függetlenül a csomag `package.json`-jától.
- **Verziószám: nem itt.** A `@anthropic-ai/claude-agent-sdk` pontos, pinelt verziója a
  `package.json`-ban és a `docs/research/2026-08-26-toolchain.md` "Rögzített verziók"
  táblázatában van. Ez a fájl csak a csomag nevére hivatkozik, számra nem: egy
  verzióemelésnél így csak egy helyen kell a számot módosítani.
- **Futtatás.** Előfeltétel: a `MINIMAX_API_KEY` elérhető a repo gyökér `.env` fájljában,
  vagy a `process.env`-ben.

  ```bash
  bun install                 # függőségek telepítése
  bun run typecheck           # tsc --noEmit, strict, nincs any/as

  bun run proxy                                       # a proxy indítása (alapport 8787)
  WIRE_PROBE_PORT=9000 bun run proxy                  # más porton
  WIRE_PROBE_UPSTREAM=https://... bun run proxy       # más upstream

  bun run probe M-01                                  # egy mérési eset
  bun run probe M-01 M-02 M-03                        # több eset
  bun run probe --all                                 # az összes

  bun run summary                                     # rövid, token-takarékos összefoglaló
  ```

  A proxy külön processz - előbb azt kell elindítani, utána a `probe`-ot egy másik
  terminálban. A `probe` a `WIRE_PROBE_PORT` env változóból olvassa, melyik proxy porton
  keresztül menjen (ugyanaz az érték, amit a proxynak is beállítottál).

- **Útvonal-konvenció.** A proxy tisztán origin-cserét végez - a bejövő kérés útvonalát
  (path + query) változatlanul a beállított upstream origin-jéhez fűzi. Emiatt az
  `ANTHROPIC_BASE_URL`-nek, amit a harness a `Options.env`-en keresztül beállít, ugyanazt
  az útvonal-előtagot kell tartalmaznia, mint az upstream URL-nek - ez alapból mindkét
  oldalon `/anthropic` (lásd SPEC-000 4. szekció "Közös alapbeállítás").
- **Artefaktumok.** `tools/wire-probe/artifacts/` - a `.gitignore`-ban szerepel, sosem
  kerül gitbe. A proxy minden tranzakciót egy önálló, sorszámozott JSON fájlba ír
  közvetlenül az `artifacts/` alá. A harness minden mérési eset (és futásán belüli minden
  `run`) `SDKMessage` folyamát és meta adatait az
  `artifacts/harness/<caseId>/<runId>.sdk-messages.ndjson` és
  `artifacts/harness/<caseId>/<runId>.meta.json` fájlokba írja. A SPEC-000 3. szekciójában
  leírt `docs/measurements/2026-08-26-minimax/M-XX/` végleges, gitbe kerülő struktúra
  ezekből a nyersanyagokból áll össze, egy külön lépésben - az nem ennek a mappának a
  feladata.
- **Maszkolás.** Az `authorization` és `x-api-key` header értéke hossz- és
  utolsó-4-karakter-megtartó maszkot kap (`maskSecretValue`, `src/proxy/mask.ts`). A
  teljes szerializált tranzakció (és a harness `meta.json`-ja) még egyszer át van fésülve
  a ténylegesen ismert `MINIMAX_API_KEY` értékre: minden előfordulás `REDACTED`-re
  cserélődik, memóriában, a lemezre írás előtt (`redactKnownSecrets`). Nyers, maszkolatlan
  artefaktum sosem íródik lemezre. Ellenőrzés commit előtt:
  `grep -r "$MINIMAX_API_KEY" tools/wire-probe/artifacts/` nulla találatot kell adjon.
- **Ismert, ellenőrzött korlátozás.** A telepített SDK `Options` típusában **nincs**
  közvetlen "max kimenő token" mező. A részletes indoklás és a talált alternatívák
  (`maxTurns`, `maxBudgetUsd`, az alpha `taskBudget`, ami éppen az `output_config` mezőt
  szennyezné be) a `src/harness/sdk-constants.ts` tetején olvasható forrás-hivatkozásokkal.

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-000-provider-wire-measurement.md`](../../docs/spec/SPEC-000-provider-wire-measurement.md)
- [`../../docs/spec/SPEC-001-monorepo-toolchain.md`](../../docs/spec/SPEC-001-monorepo-toolchain.md), 13. szekció ("A `tools/wire-probe` viszonya")
- [`../../docs/research/2026-08-26-agent-sdk-minimax.md`](../../docs/research/2026-08-26-agent-sdk-minimax.md)
- [`../../docs/research/2026-08-26-toolchain.md`](../../docs/research/2026-08-26-toolchain.md): a `@anthropic-ai/claude-agent-sdk` és a `zod` pontos verziója
