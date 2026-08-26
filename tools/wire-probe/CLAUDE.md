# tools/wire-probe

A SPEC-000 (`docs/spec/SPEC-000-provider-wire-measurement.md`) mérőeszköze: egy logoló
reverse proxy és egy mérési harness a `minimax` provider drótszintű viselkedésének
felderítéséhez. A gyökér Bun workspace tagja (`tools/*` glob), saját `package.json`-ja
van, de a `tsconfig.json`-ja a `tooling/tsconfig/node.json` fájlt terjeszti ki, és nincs
saját `bun.lock`-ja -- a függőségei a gyökér lockfile-ba olvadnak. Nem termékkód, tooling
-- de a projekt szigorú TypeScript szabályai (`strict`, nincs `any`, nincs `as`, valódi
`#private` mező) rá is vonatkoznak. `test` scriptje nincs, tehát a mérések nem futnak a
Turborepo `test` taskján keresztül CI-ben.

**Kivétel: `src/no-shadowed-path-import.test.ts`.** Ez az egyetlen Vitest teszt a
csomagban -- regressziós teszt egy korábban talált valós bugra (két mérési eset fájlban
egy helyi `const path = ...` eltakarta a `node:path` importot, temporal dead zone
`ReferenceError` kockázatával). A csomagnak nincs saját `test` npm scriptje, a teszt
mégis lefut: a gyökér `vitest.config.ts` a `tools/wire-probe/src/**/*.test.ts` mintát
explicit projektként veszi fel a Vitest saját "Test Projects" mechanizmusán keresztül,
függetlenül a csomag `package.json`-jától. A `probe`/`proxy`/`summary` (valós API
hívást tevő) scriptek ettől függetlenül nem futnak CI-ben.

## Miért van itt két külön dolog

- **A proxy** (`src/proxy.ts`) egy loopback HTTP szerver, amit `ANTHROPIC_BASE_URL`-nek
  állítunk be. Mindent továbbít az upstreamre (`https://api.minimax.io/anthropic`
  alapértelmezésként), bájtszinten, útvonal-fehérlista nélkül, és minden tranzakciót
  maszkolva rögzít.
- **A harness** (`src/probe.ts` + `src/cases/`) az Agent SDK `query()`-jét hívja a
  SPEC-000 4. szekciójában felsorolt mérési esetek szerint (M-01 ... M-18), a proxyn
  keresztül, hogy a tényleges HTTP forgalom rögzüljön.

## Futtatás

Előfeltétel: a `MINIMAX_API_KEY` elérhető a repo gyökér `.env` fájljában, vagy a
`process.env`-ben.

```bash
bun install                 # függőségek telepítése (@anthropic-ai/claude-agent-sdk@0.3.245 pontosan pinelve)
bun run typecheck           # tsc --noEmit, strict, nincs any/as

bun run proxy                                       # a proxy indítása (alapport 8787)
WIRE_PROBE_PORT=9000 bun run proxy                  # más porton
WIRE_PROBE_UPSTREAM=https://... bun run proxy       # más upstream

bun run probe M-01                                  # egy mérési eset
bun run probe M-01 M-02 M-03                        # több eset
bun run probe --all                                 # mind a 18

bun run summary                                     # rövid, token-takarékos összefoglaló
```

A proxy külön processz -- előbb azt kell elindítani, utána a `probe`-ot egy másik
terminálban. A `probe` a `WIRE_PROBE_PORT` env változóból olvassa, melyik proxy porton
keresztül menjen (ugyanaz az érték, amit a proxynak is beállítottál).

**Útvonal-konvenció:** a proxy tisztán origin-cserét végez -- a bejövő kérés útvonalát
(path + query) változatlanul a beállított upstream origin-jéhez fűzi. Emiatt az
`ANTHROPIC_BASE_URL`-nek, amit a harness a `Options.env`-en keresztül beállít, ugyanazt
az útvonal-előtagot kell tartalmaznia, mint az upstream URL-nek -- ez alapból mindkét
oldalon `/anthropic` (lásd SPEC-000 4. szekció "Közös alapbeállítás").

## Hova kerülnek az artefaktumok

`tools/wire-probe/artifacts/` -- **a `.gitignore`-ban szerepel, sosem kerül gitbe.**

- A proxy minden tranzakciót egy önálló, sorszámozott JSON fájlba ír közvetlenül az
  `artifacts/` alá: `00001-<epoch-ms>.json`, `00002-...json`, ...
- A harness minden mérési eset (és futásán belüli minden `run`) SDKMessage folyamát és
  meta adatait az `artifacts/harness/<caseId>/<runId>.sdk-messages.ndjson` és
  `artifacts/harness/<caseId>/<runId>.meta.json` fájlokba írja.
- Az `M-09` eset emellett egy `artifacts/harness/M-09/a.tool-callback-input.json`
  fájlba is ír, hogy a tool callback ténylegesen megkapott argumentuma bájtszinten
  összevethető legyen az `sdk-messages.ndjson` assistant `tool_use` inputjával (Q7).

A SPEC-000 3. szekciójában leírt `docs/measurements/2026-08-26-minimax/M-XX/` végleges,
gitbe kerülő struktúra ezekből az `artifacts/` nyersanyagokból áll össze -- annak
összeállítása **nem ennek a mappának a feladata**, azt egy külön lépés végzi a teljes
M-01...M-18 sorozat lefuttatása után.

## Maszkolás

- `src/proxy/mask.ts`: az `authorization` és `x-api-key` header értéke hossz- és
  utolsó-4-karakter-megtartó maszkot kap (`maskSecretValue`), hogy azonosítható maradjon
  melyik kulcs volt, de a titok ne szivárogjon.
- Emellett a teljes szerializált tranzakció (és a harness `meta.json`-ja) még egyszer át
  van fésülve a ténylegesen ismert `MINIMAX_API_KEY` értékre: minden előfordulás
  `REDACTED`-re cserélődik, memóriában, a lemezre írás előtt (`redactKnownSecrets`).
- Nyers, maszkolatlan artefaktum sosem íródik lemezre.
- Ellenőrzés commit előtt: `grep -r "$MINIMAX_API_KEY" tools/wire-probe/artifacts/`
  nulla találatot kell adjon.

## Fájlstruktúra

```
src/
  proxy.ts               a proxy belépési pontja (CLI: bun run proxy)
  proxy/
    types.ts              RecordedTransaction és StreamEventRecord típusok
    mask.ts                header- és szöveg-maszkoló segédfüggvények
    recorder.ts             TransactionRecorder: sorszámozott JSON fájlba írás
  probe.ts                a harness belépési pontja (CLI: bun run probe <eset...>)
  harness/
    types.ts               CaseContext, MeasurementCase, CaseRunOutcome
    environment.ts           MINIMAX_API_KEY betöltése process.env-ből vagy .env-ből
    sdk-constants.ts         a telepített SDK típusdefiníciójából kiolvasott enumok
    runner.ts                közös futtató logika: executeQuery(), buildBaseOptions()
  cases/
    index.ts                típusos registry: CASE_REGISTRY, CASE_IDS
    m-01.ts ... m-36.ts      egy mérési eset egy fájlban, a SPEC-000 4. szekció szerint
  summary.ts               token-takarékos összefoglaló script (CLI: bun run summary)
  no-shadowed-path-import.test.ts   regressziós teszt, lásd fent
```

## Ismert, ellenőrzött korlátozás

A telepített `@anthropic-ai/claude-agent-sdk@0.3.245` `Options` típusában **nincs**
közvetlen "max kimenő token" mező. A részletes indoklás és a talált alternatívák
(`maxTurns`, `maxBudgetUsd`, az alpha `taskBudget`, ami éppen az `output_config` mezőt
szennyezné be) a `src/harness/sdk-constants.ts` tetején olvasható forrás-hivatkozásokkal.
