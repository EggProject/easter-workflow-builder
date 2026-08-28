# PLAN-004: A csomagok belső mappaszerkezetének rendbetétele

|          |                                                                                                                                                                                                    |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Státusz  | tervezet, végrehajtás előtt user jóváhagyást igényel                                                                                                                                               |
| Dátum    | 2026-08-28                                                                                                                                                                                         |
| Ág       | `feat/spec-003-domain-perzisztencia`                                                                                                                                                               |
| Előzmény | [`../spec/SPEC-002-csomag-architektura.md`](../spec/SPEC-002-csomag-architektura.md) 6. szekció, [`../spec/SPEC-003-domain-perzisztencia.md`](../spec/SPEC-003-domain-perzisztencia.md) 8. szekció |
| Kimenet  | 57 fájl mozdul, mind a `packages/db` csomagon belül, három téma mappából tíz lesz; a többi 24 csomag szerkezete változatlan                                                                        |

---

## 1. Cél és hatókör

### A user kifogása, szó szerint

> "nekem az a bajom hogy egy mappaba bedobalsz mindenfajta fajlt de az ugy nagyon nehezen
> keresheto, ha holnap leultetek egy juniort a kod ele nehezen fogja megerteni, sokkal jobb
> ha tovabbi subdirectory strukuralast vegzunk, a package -ek jok, nem az a bajom! azon
> belul nincs rend! kertem egy pontos tervezetet mielott atalakitod"

És a hatókörre:

> "mindegyik csomagot nezd at es ha van ertelme a javaslatban tedd meg, nem biztos hogy az
> osszeset at kell varialni, nezd at"

### Amit ez a terv eldönt

- Egy írott, alkalmazható **bontási kritériumot**, ami nem darabszám küszöb (3. szekció).
- A repo mind a 25 csomagjának minden téma mappájára, hogy bontjuk-e vagy marad, és miért (2. és 5. szekció).
- A `packages/db` csomag három nagy téma mappájának fájlszintű átrendezését (4. szekció).
- A végrehajtás fázisait úgy, hogy minden fázis után mind a nyolc minőségi kapu zöld (7. szekció).
- Azt, hogy a SPEC-002 rögzített konvenciójából mit kell átvezetni (8. szekció).

### Amit ez a terv NEM dönt el

- **Nem nyúl a csomagfelosztáshoz.** A user kifejezetten kimondta: "a package -ek jok". Egyetlen csomag sem szűnik meg, nem keletkezik és nem olvad össze. A `check:graph` réteg térkép változatlan.
- **Nem ír át kódot.** Egyetlen exportált szimbólum, egyetlen függvénytörzs, egyetlen `Fact` és egyetlen SQL séma sem változik. Csak fájlok helye és a rájuk mutató relatív import specifikátorok.
- **Nem bővíti a `coverage.exclude` listát**, és nem változtat a teszt darabszámon.
- **Nem hajtja végre önmagát.** A user kérése: "kertem egy pontos tervezetet mielott atalakitod". A végrehajtás külön jóváhagyással indul.

## 2. Leltár

Mérés: 2026-08-28, a `feat/spec-003-domain-perzisztencia` ágon,
`find packages/*/src apps/*/src tooling/*/src tools/*/src -type f`. A darabszám a mappa
**közvetlen** fájljait számolja, a `.ts`, a `.spec.ts` és a `.json` fixture fájlt együtt. A
csomag gyökerében álló `src/index.ts` barrel egyik mappához sem tartozik, ezért külön nem
szerepel.

### 2.1 Ahol a fájdalom van

| Csomag                | Mappa                    | Fájl | Bontandó                                   |
| --------------------- | ------------------------ | ---- | ------------------------------------------ |
| `tools/wire-probe`    | `src/cases/`             | 37   | nem, hatókörön kívül (SPEC-002 6.8)        |
| `packages/db`         | `src/workflow-graph/`    | 24   | **igen**, négy témára                      |
| `packages/db`         | `src/graph-snapshot/`    | 18   | **igen**, három témára                     |
| `packages/db`         | `src/run-event/`         | 15   | **igen**, három témára                     |
| `provider-capability` | `src/request-shaping/`   | 11   | nem, a fájlnevek megnevezik a csoportot    |
| `packages/db`         | `src/step-run/`          | 9    | nem, a fájlnevek megnevezik a csoportot    |
| `packages/db`         | `src/workflow-run/`      | 9    | nem, a fájlnevek megnevezik a csoportot    |
| `packages/db`         | `src/human-approval/`    | 7    | nem                                        |
| `packages/db`         | `src/database-file/`     | 6    | nem                                        |
| `packages/db`         | `src/sqlite-connection/` | 6    | nem, egy fájl mégis rossz helyen van (4.4) |

### 2.2 A `packages/db` teljes leltára, 107 fájl plusz a barrel

| Mappa                   | Fájl | Tartalom, egy mondatban                                                                                                     |
| ----------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------- |
| `workflow-graph/`       | 24   | három tábla, a `WorkflowRepository`, a `NodeType` unió, a node config unió, az `AgentStepConfig` és mind a négy typeguardja |
| `graph-snapshot/`       | 18   | a `graph_snapshot` tábla, a dokumentum típus és verzió unió, a kanonizáló, a `sha256` lenyomat, a fixture, a visszaolvasó   |
| `run-event/`            | 15   | a `run_event` tábla, a 25 értékű `RunEventKind` unió, az SDK üzenet normalizálás, a `RunEventRepository`                    |
| `step-run/`             | 9    | a `step_run` tábla, a `StepRunStatus` és az átmeneti szabály, a `StepRunRepository`                                         |
| `workflow-run/`         | 9    | a `workflow_run` tábla, a `RunStatus` és az átmeneti szabály, a `WorkflowRunRepository`                                     |
| `human-approval/`       | 7    | a `human_approval` tábla, az `ApprovalDecision` unió és guardja, a repository                                               |
| `database-file/`        | 6    | az env változó neve, az alapértelmezett útvonal, a könyvtár létrehozása, a feloldó                                          |
| `sqlite-connection/`    | 6    | `openDatabase`, `DatabaseContext`, tranzakció hibaleírás, plusz a barrel exportlistát őrző spec                             |
| `app-setting/`          | 4    | az `app_setting` tábla és az `AppSettingRepository`                                                                         |
| `provider-concurrency/` | 4    | a `provider_concurrency_limit` tábla és a repository                                                                        |
| `migration/`            | 3    | a migrációs mappa útvonala és a `migrate()` hívás `Outcome` burkolása                                                       |
| `run-recovery/`         | 2    | a `RunRecovery` és a tesztje, nincs saját tábla                                                                             |

### 2.3 A többi 24 csomag leltára

| Csomag                                                 | Téma mappák, fájlszámmal                                                                                                                                                                                                                  | Összesen |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `packages/typeguards`                                  | 17 mappa, `is-function` 4, `is-constructor` 3, `is-string-resolver` 3, `test-constants` 1, a maradék 13 mind 2                                                                                                                            | 37       |
| `packages/provider-capability`                         | `request-shaping` 11, `evidence/fact` 5, `evidence/evidence-reference` 3, `evidence-sources/measurement-document` 3, `limits` 3, `provider-id` 3, `environment` 2, `model-catalog` 2, `tool-support` 2, `descriptor` 1, `agent-tool-id` 1 | 36       |
| `packages/core`                                        | `http-client/request` 6, `env-reader/environment-reader` 5, `image-source/media-type` 5, `image-source/data-url` 3, `result/outcome` 3, `http-client/error-description` 2                                                                 | 24       |
| `packages/minimax-client`                              | `minimax-config` 5, `search` 5, `call-minimax` 3, `envelope` 3, `vlm` 3                                                                                                                                                                   | 19       |
| `packages/provider-minimax`                            | `request-shaping` 6, `model-catalog` 3, `environment` 2, `limits` 2, `tool-support` 2, `descriptor` 1                                                                                                                                     | 16       |
| `packages/provider-claude-subscription`                | ugyanaz a hat téma, ugyanazokkal a darabszámokkal                                                                                                                                                                                         | 16       |
| `packages/firecrawl-client`                            | `firecrawl-config` 5, `scrape-document` 5, `scrape-call` 3                                                                                                                                                                                | 13       |
| `packages/agent-tool-bundle`                           | `tool-bundle` 3, `tool-dependencies` 3, `tool-reference` 3, `tool-factory` 2                                                                                                                                                              | 11       |
| `packages/mcp-tool-kit`                                | `tool-call-result` 5                                                                                                                                                                                                                      | 5        |
| `packages/tool-minimax-web-search`                     | `web-search-tool` 3                                                                                                                                                                                                                       | 3        |
| `packages/tool-firecrawl-web-fetch`                    | `web-fetch-tool` 3                                                                                                                                                                                                                        | 3        |
| `packages/tool-minimax-understand-image`               | `understand-image-tool` 3                                                                                                                                                                                                                 | 3        |
| `packages/provider-registry`                           | `provider-registry` 2                                                                                                                                                                                                                     | 2        |
| `packages/agent`, `engine`, `logger`, `protocol`, `ui` | nincs téma mappa, csak placeholder `index.ts`                                                                                                                                                                                             | 0        |
| `apps/server`                                          | csak `index.ts`                                                                                                                                                                                                                           | 0        |
| `apps/web`                                             | csak `index.ts` és a 6.8 szerinti `main.ts`                                                                                                                                                                                               | 1        |
| `tooling/scripts`                                      | `dependency-graph` 5, `casing` 4, `turbo-e2e-coverage-outputs` 1                                                                                                                                                                          | 10       |
| `tooling/eslint-config`                                | `eslint-preset` 4                                                                                                                                                                                                                         | 4        |
| `tooling/tsconfig`                                     | csak `index.ts`                                                                                                                                                                                                                           | 0        |
| `tools/wire-probe`                                     | `cases` 37, `harness` 4, `proxy` 3, plusz 4 fájl a `src/` tetején                                                                                                                                                                         | 48       |

**Amit a leltár mutat.** A repo 25 csomagjából **egyetlen egyben** van valódi probléma: a
`packages/db` csomagban. Ott három mappa (24, 18 és 15 fájl) fog össze egymástól jól
elkülönülő fogalmakat úgy, hogy a fájlnevekből nem derül ki a hovatartozás. A második
legnagyobb mappa a `tools/wire-probe/src/cases` 37 mérési eset fájllal, de az egy fogalom
egy mappában (`m-01.ts` ... `m-36.ts`), és a SPEC-002 6.8 pontja szerint a csomag a
konvenció hatókörén kívül van. A harmadik a `provider-capability/src/request-shaping` 11
fájllal, ott viszont a fájlnevek maguk mondják meg a csoportot.

## 3. A bontási kritérium

**Darabszám küszöböt nem rögzítünk.** Nincs rá forrásunk, és a projekt szabálya tiltja a
kitalált számot. A darabszám csak annyit jelent, hogy ott érdemes lefuttatni az alábbi
próbát; a döntést a próba hozza meg, nem a szám.

### 3.1 A bontási próba, mindhárom feltétel kell

1. **Több fogalom.** A mappa fájljai legalább két olyan csoportba esnek, aminek külön,
   felismerhető domain neve van, és egyetlen fájl sem tartozik egyszerre kettőbe.
2. **A fájlnév nem árulja el a csoportot.** Ez a junior teszt gépi alakja: ha a fájlnevek
   közös előtaggal már megnevezik a csoportot (`thinking-capability.ts` és
   `thinking-mode.ts`, `step-run-status.ts` és `is-step-run-status.ts`), akkor a mappa
   önmagát dokumentálja, és a bontás nulla információt tenne hozzá. Bontani akkor kell, ha
   van olyan fájl, aminek a nevéből egy junior nem tudja megmondani, melyik csoporthoz
   tartozik (`session-mode.ts`, `engine-hook-id.ts`, `sandbox-config.ts` a 24 fájlos
   `workflow-graph/` mappában).
3. **Az irány körmentes.** A csoportok között az import irány egyirányú. Ha két csoport
   oda-vissza hivatkozik, akkor az egy fogalom volt, nem kettő.

### 3.2 A negatív próba, bármelyik megállítja a bontást

4. **Nincs domain neve.** Ha a csoportnak csak technikai réteg neve adható (`schema/`,
   `model/`, `guard/`, `repository/`, `types/`, `utils/`), akkor az nem csoport. A SPEC-002
   6.5 szekció ezeket a neveket tiltja, és a tiltás oka pontosan ez.
5. **A typeguard elszakadna attól, amit őriz.** A `is-<x>.ts` mindig ugyanabban a mappában
   áll, mint az `<x>.ts`. Ha egy bontási határ elvágná a kettőt, a határ rossz helyen van.
   Ez a szabály a 4. szekció mindhárom bontásánál eldöntött legalább egy határt.
6. **A teszt elszakadna a megvalósítástól.** A `.spec.ts` mindig a párja mellett marad.

Egy fájl akkor áll egyedül egy új almappában, ha a fogalomnak ténylegesen egy fájlja van,
nem azért, mert máshova nem fért be. Ez a SPEC-002 8. elfogadási kritériumának a szabálya,
változatlanul.

## 4. Fájlszintű terv: `packages/db`

Ez az egyetlen érintett csomag. A `src/` alatt tizenkét mappa áll; ebből **három** kap belső
tagolást, **kilenc változatlan marad**. A három érintett mappa a tagolás után **tárgykör**
mappa lesz, a SPEC-002 6.1 pont 8. szabályának alakjában (`src/<tárgykör>/<téma>/`), a
kilenc érintetlen továbbra is **téma** mappa marad közvetlenül a `src/` alatt. Ez a vegyes
alak megengedett: a `provider-capability` csomag ma pontosan így áll (SPEC-002 6.1, "A
`provider-capability` a vegyes eset"), csak eggyel feljebb, a `src/` szintjén.

### 4.1 `src/workflow-graph/`, 24 fájl, négy téma

**Miért bontjuk.** A mappa négy, egymástól jól elkülönülő fogalmat fog össze: a tárolt
gráfot (három tábla plusz a repository), a node típus szótárát, a node config uniót és az
agent lépés beállításait. A junior teszt itt élesen bukik: a `session-mode.ts`, az
`engine-hook-id.ts`, a `sandbox-config.ts` és a `storable-mcp-server.ts` névből semmi nem
mondja meg, hogy ezek mind az `AgentStepConfig` mezőalakjai.

Jelenlegi fa (lapos, 24 fájl egymás mellett):

```
src/workflow-graph/
  agent-step-config.ts        is-node-config.spec.ts      storable-mcp-server.ts
  engine-hook-id.ts           is-node-config.ts           workflow-edge.spec.ts
  is-agent-step-config.spec.ts is-node-type.spec.ts       workflow-edge.ts
  is-agent-step-config.ts     is-node-type.ts             workflow-node.spec.ts
  is-string-array.spec.ts     node-config.ts              workflow-node.ts
  is-string-array.ts          node-type.ts                workflow-repository.spec.ts
  sandbox-config.ts           script-config.ts            workflow-repository.ts
  session-mode.ts             workflow.spec.ts            workflow.ts
```

Javasolt fa:

```
src/workflow-graph/
  workflow/            8 fajl   a workflow sor es a graf sorai, meg az egyetlen repository
  node-type/           3 fajl   a tiz node tipus szotara es a guardja
  node-config/         6 fajl   a workflow_node.config unio es a guardja
  agent-step-config/   7 fajl   az agent lepes SDK beallitasai es a guardja
```

Fájlszintű leképezés:

| Jelenlegi fájl                 | Cél téma             | Miért oda                                                                                         |
| ------------------------------ | -------------------- | ------------------------------------------------------------------------------------------------- |
| `workflow.ts`                  | `workflow/`          | a `workflow` tábla                                                                                |
| `workflow.spec.ts`             | `workflow/`          | a megvalósítás mellett                                                                            |
| `workflow-node.ts`             | `workflow/`          | a `workflow` gyerektáblája, idegen kulccsal                                                       |
| `workflow-node.spec.ts`        | `workflow/`          | a megvalósítás mellett                                                                            |
| `workflow-edge.ts`             | `workflow/`          | a `workflow` másik gyerektáblája                                                                  |
| `workflow-edge.spec.ts`        | `workflow/`          | a megvalósítás mellett                                                                            |
| `workflow-repository.ts`       | `workflow/`          | mind a három táblát egyetlen tranzakcióban írja, nem szedhető szét                                |
| `workflow-repository.spec.ts`  | `workflow/`          | a megvalósítás mellett                                                                            |
| `node-type.ts`                 | `node-type/`         | a tíz node típus uniója                                                                           |
| `is-node-type.ts`              | `node-type/`         | typeguard a párja mellett (3.2 pont 5. szabálya)                                                  |
| `is-node-type.spec.ts`         | `node-type/`         | a megvalósítás mellett                                                                            |
| `node-config.ts`               | `node-config/`       | a `workflow_node.config` unió                                                                     |
| `is-node-config.ts`            | `node-config/`       | typeguard a párja mellett                                                                         |
| `is-node-config.spec.ts`       | `node-config/`       | a megvalósítás mellett                                                                            |
| `script-config.ts`             | `node-config/`       | a `script` node és a `join` node `script` módjának közös alobjektuma, mindkettő a config unió ága |
| `is-string-array.ts`           | `node-config/`       | lásd a 4.5 szekciót, ez a terv egyetlen kényszeredett elhelyezése                                 |
| `is-string-array.spec.ts`      | `node-config/`       | a megvalósítás mellett                                                                            |
| `agent-step-config.ts`         | `agent-step-config/` | az `AgentStepConfig` típus                                                                        |
| `is-agent-step-config.ts`      | `agent-step-config/` | typeguard a párja mellett                                                                         |
| `is-agent-step-config.spec.ts` | `agent-step-config/` | a megvalósítás mellett                                                                            |
| `sandbox-config.ts`            | `agent-step-config/` | az `AgentStepConfig.sandbox` mező alakja                                                          |
| `storable-mcp-server.ts`       | `agent-step-config/` | az `AgentStepConfig.mcpServers` mező alakja                                                       |
| `session-mode.ts`              | `agent-step-config/` | az `AgentStepConfig.sessionMode` mező alakja                                                      |
| `engine-hook-id.ts`            | `agent-step-config/` | az `AgentStepConfig.enabledEngineHooks` mező alakja                                               |

Import irány a témák között: `workflow` -> `node-config`, `node-type`; `node-config` ->
`agent-step-config`, `node-type`. Körmentes, egy kivétellel, amit a 4.5 szekció külön kezel.

### 4.2 `src/graph-snapshot/`, 18 fájl, három téma

**Miért bontjuk.** A mappa három fogalmat fog össze: a tárolt sort és a
megváltoztathatatlanságát, a JSON dokumentum alakját és verziózását, és a kanonizálást a
lenyomattal. A `canonicalize-snapshot-document.ts`, a `compute-snapshot-hash.ts` és a
`resolve-snapshot-reuse.ts` névből egy junior nem tudja megmondani, melyik a tábla és melyik
a dokumentum ügye.

Javasolt fa:

```
src/graph-snapshot/
  stored-snapshot/     5 fajl   a graph_snapshot sor, a valtoztathatatlansaga, az ujrafelhasznalas dontese
  snapshot-document/   7 fajl   a dokumentum alakja, a verzio unioja, a visszaolvaso es a ket guard
  snapshot-hash/       6 fajl   az RFC 8785 kanonizalas, a sha256 lenyomat, es a commitolt fixture ami orzi oket
```

| Jelenlegi fájl                               | Cél téma             | Miért oda                                                                   |
| -------------------------------------------- | -------------------- | --------------------------------------------------------------------------- |
| `graph-snapshot.ts`                          | `stored-snapshot/`   | a `graph_snapshot` tábla                                                    |
| `graph-snapshot.spec.ts`                     | `stored-snapshot/`   | a megvalósítás mellett                                                      |
| `graph-snapshot-immutability.spec.ts`        | `stored-snapshot/`   | a táblán álló `BEFORE UPDATE` triggert őrzi, tehát a tárolt sorét           |
| `resolve-snapshot-reuse.ts`                  | `stored-snapshot/`   | eldönti, a meglévő sort használjuk-e vagy újat szúrunk be                   |
| `resolve-snapshot-reuse.spec.ts`             | `stored-snapshot/`   | a megvalósítás mellett                                                      |
| `graph-snapshot-document.ts`                 | `snapshot-document/` | a dokumentum típus és a verzió unió                                         |
| `is-graph-snapshot-document-v1.ts`           | `snapshot-document/` | typeguard a párja mellett                                                   |
| `is-graph-snapshot-document-v1.spec.ts`      | `snapshot-document/` | a megvalósítás mellett                                                      |
| `is-graph-snapshot-document-version.ts`      | `snapshot-document/` | ugyanannak a fájlnak a verzió unióját őrzi                                  |
| `is-graph-snapshot-document-version.spec.ts` | `snapshot-document/` | a megvalósítás mellett                                                      |
| `read-graph-snapshot.ts`                     | `snapshot-document/` | a verziódiszpécser, a két guardot használja                                 |
| `read-graph-snapshot.spec.ts`                | `snapshot-document/` | a megvalósítás mellett                                                      |
| `canonicalize-snapshot-document.ts`          | `snapshot-hash/`     | a kanonikus szöveg, ami a lenyomat bemenete                                 |
| `canonicalize-snapshot-document.spec.ts`     | `snapshot-hash/`     | a megvalósítás mellett                                                      |
| `compute-snapshot-hash.ts`                   | `snapshot-hash/`     | a `sha256` lenyomat                                                         |
| `compute-snapshot-hash.spec.ts`              | `snapshot-hash/`     | a megvalósítás mellett                                                      |
| `graph-snapshot-document-v1-fixture.json`    | `snapshot-hash/`     | a fixture célja a lenyomat literál őrzése, nem a dokumentum alakjáé         |
| `graph-snapshot-document-v1-fixture.spec.ts` | `snapshot-hash/`     | ez a teszt bukik meg, ha a kanonizálás vagy a lenyomat csendben megváltozik |

Import irány: `stored-snapshot` -> `snapshot-hash` (csak `.spec.ts` szinten),
`snapshot-hash` -> `snapshot-document` (csak a fixture spec). Termékkódban a három téma nem
hivatkozik egymásra. Körmentes.

### 4.3 `src/run-event/`, 15 fájl, három téma

**Miért bontjuk.** Három fogalom: a `kind` szótár, a nyers SDK üzenet normalizálása, és maga
az esemény sor a repositoryval. Az `is-sdk-message-envelope.ts` és a `run-event-kind.ts`
névből egy junior nem tudja megmondani, melyik melyik réteghez tartozik.

Javasolt fa:

```
src/run-event/
  event-record/   8 fajl   a run_event tabla, a repository es a ket iro segedje
  event-kind/     3 fajl   a 25 ertekű RunEventKind unio es a guardja
  sdk-message/    4 fajl   a nyers SDK uzenet borítekja es normalizalasa
```

| Jelenlegi fájl                    | Cél téma        | Miért oda                                                      |
| --------------------------------- | --------------- | -------------------------------------------------------------- |
| `run-event.ts`                    | `event-record/` | a `run_event` tábla                                            |
| `run-event.spec.ts`               | `event-record/` | a megvalósítás mellett                                         |
| `run-event-repository.ts`         | `event-record/` | az egyetlen író és olvasó felület a táblára                    |
| `run-event-repository.spec.ts`    | `event-record/` | a megvalósítás mellett                                         |
| `insert-engine-event-row.ts`      | `event-record/` | a tranzakció nélküli beszúró segéd, kizárólag ehhez a táblához |
| `insert-engine-event-row.spec.ts` | `event-record/` | a megvalósítás mellett                                         |
| `extract-error-cause.ts`          | `event-record/` | a repository beszúrási hibaágának segédje, más nem hívja       |
| `extract-error-cause.spec.ts`     | `event-record/` | a megvalósítás mellett                                         |
| `run-event-kind.ts`               | `event-kind/`   | a 25 értékű unió                                               |
| `is-run-event-kind.ts`            | `event-kind/`   | typeguard a párja mellett                                      |
| `is-run-event-kind.spec.ts`       | `event-kind/`   | a megvalósítás mellett                                         |
| `normalize-sdk-message.ts`        | `sdk-message/`  | a nyers SDK üzenet oszlopokra bontása                          |
| `normalize-sdk-message.spec.ts`   | `sdk-message/`  | a megvalósítás mellett                                         |
| `is-sdk-message-envelope.ts`      | `sdk-message/`  | a boríték guardja, a normalizáló egyetlen hívója               |
| `is-sdk-message-envelope.spec.ts` | `sdk-message/`  | a megvalósítás mellett                                         |

Import irány: `event-record` -> `event-kind`, `sdk-message`; `sdk-message` -> `event-kind`;
`event-kind` -> semmi. Aciklikus fa, három szinten.

### 4.4 Két kisebb javaslat, külön eldöntendő

Ez a két tétel nem következik a fenti három bontásból, és a user külön döntését igényli.
Ha nemet mond, a 4.1 és a 4.3 terve akkor is végrehajtható, a 4.5 szekció fallback ágával.

| Javaslat                                                                                        | Indok                                                                                                                                                                                                                                                                                                                                                                                         | Kockázat                     |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `packages/db/src/sqlite-connection/barrel-exports.spec.ts` -> `packages/db/src/barrel-exports/` | Ez a spec a `src/index.ts` barrel exportlistáját őrzi, nem a SQLite kapcsolatot. A SPEC-002 6.2 pont 5. szabálya pontosan erre az esetre mondja ki: a megvalósítás nélküli regressziós teszt mappája **annak a dolognak a neve, amit őriz**. A fájl `import.meta.dirname` alapon `'..', 'index.ts'` útvonalat számol, ami az új helyen ugyanaz a mélység, tehát a fájl tartalma nem változik. | nulla, a mélység azonos      |
| `isStringArray` -> `packages/typeguards/src/is-string-array/`                                   | Lásd a 4.5 szekciót.                                                                                                                                                                                                                                                                                                                                                                          | közepes, csomaghatárt lép át |

### 4.5 Ahol a rögzített megkötés kényszeredett eredményt ad

**A `packages/db/src/workflow-graph/is-string-array.ts` fájlnak nincs domain témája.** Ez a
terv egyetlen pontja, ahol a "téma szerinti tagolás" megkötése nem ad jó választ, és a
feladat kérése szerint ezt kimondom, nem kerülöm meg.

A tények:

- A `readonly string[]` alakot ellenőrzi, semmi mást. Nem a gráfról szól, nem a node
  configról, nem az agent lépésről.
- Három téma használja a bontás után: a `node-config` (`is-node-config.ts`), az
  `agent-step-config` (`is-agent-step-config.ts`) és a `workflow-run` téma
  (`workflow-run-repository.ts` importálja `../workflow-graph/is-string-array.ts` alakban).
- A saját fejlécdokumentációja is ezt ismeri be: "A node config unió és az `AgentStepConfig`
  több mezője ... ilyen alakú, ezért a `workflow-graph` téma egy helyen tartja."
- Bárhova tesszük a négy téma közül, a másik három onnan importál, és a `node-config` ->
  `agent-step-config` irány mellé egy visszamutató mappa szintű él kerül. **Gépi kaput ez nem
  bukik el**: az `import-x/no-cycle` fájl szintű kört néz, és fájl szintű kör nincs. De a
  mappafa attól még hazudik.

**A javasolt megoldás: a fájl nem a `db` csomagban való.** A helye
`packages/typeguards/src/is-string-array/`, ahol `is-string.ts`, `is-date-array.ts` és
további tizenöt társa már ma is így áll, mappánként egy fogalommal. A `packages/db` már ma
függ a `@easter-workflow-builder/typeguards` csomagtól (`package.json` `dependencies`), és a
`db` tíz fájlja már ma importál is belőle, köztük maga az `is-string-array.ts` is
(`import { isString } from '@easter-workflow-builder/typeguards'`). A mozgatás
következményei: két fájl költözik, a `typeguards` barrelje egy sorral bővül, a `typeguards`
`CLAUDE.md` `## Fájlok` táblája egy sorral bővül, és a `db` három importja csomagnév szerinti
importra vált.

**Fallback, ha a user a csomaghatár átlépését nem akarja.** A fájl a `node-config/` témába
kerül (így szerepel a 4.1 táblázatban), és az `agent-step-config/is-agent-step-config.ts`
`../node-config/is-string-array.ts` alakban importálja. Ez egyetlen kaput sem bukik el, csak
a mappafa lesz kevésbé őszinte.

**Egy hasonló, de enyhébb eset:** a `run-event/event-record/extract-error-cause.ts` szintén
általános segéd, nem esemény fogalom. Itt nem javaslok mozgatást: a fájl saját
dokumentációja szerint kizárólag a `run-event-repository.ts` beszúrási hibaága miatt
létezik, egyetlen hívója van, és a `core` csomag `describeError` fájljának mintájára
készült. Egy hívóval a "hol lakik" kérdés nem áll fenn.

## 5. Ami marad, és miért

A user kifejezetten megengedte, hogy ne mindent alakítsunk át. Az alábbi mappák a 3. szekció
próbáján **átmennek**, tehát változatlanul maradnak.

| Csomag, mappa                                                                                   | Fájl            | Melyik próbán bukik a bontás                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `provider-capability/src/request-shaping/`                                                      | 11              | 2. próba: a tizenegy fájl hat, előtaggal megnevezett párra esik (`effort-`, `thinking-`, `tool-choice-`, `structured-output-`, `streaming-`, `prompt-cach`), a név maga megmondja a csoportot. A SPEC-002 5.5 szekció ezt a mappát a `ProviderCapabilityDescriptor` egy mezőcsoportjaként indokolja, és a típus szerkezete a mappaszerkezet. |
| `provider-minimax/src/request-shaping/`                                                         | 6               | ugyanaz, plusz a két leíró csomag mappanevei szándékosan tükrözik a típuscsomagét (SPEC-002 5.6)                                                                                                                                                                                                                                             |
| `provider-claude-subscription/src/request-shaping/`                                             | 6               | ugyanaz                                                                                                                                                                                                                                                                                                                                      |
| `db/src/step-run/`                                                                              | 9               | 2. próba: `step-run.ts`, `step-run-repository.ts` és `step-run-status.ts` plusz a hozzájuk tartozó `is-` és `can-transition-` fájlok; minden név megmondja a csoportot                                                                                                                                                                       |
| `db/src/workflow-run/`                                                                          | 9               | ugyanaz a minta, `workflow-run` és `run-status` előtaggal                                                                                                                                                                                                                                                                                    |
| `db/src/human-approval/`                                                                        | 7               | 2. próba: `human-approval`, `human-approval-repository`, `approval-decision` plusz a guard                                                                                                                                                                                                                                                   |
| `db/src/database-file/`                                                                         | 6               | 2. próba: mind a hat fájl az adatbázis fájl útvonalának egy lépése                                                                                                                                                                                                                                                                           |
| `db/src/sqlite-connection/`                                                                     | 6               | 1. próba: egy fogalom, a kapcsolat megnyitása és a tranzakció; a hatodik fájlra a 4.4 tesz külön javaslatot                                                                                                                                                                                                                                  |
| `db/src/app-setting/`, `provider-concurrency/`, `migration/`, `run-recovery/`                   | 4, 4, 3, 2      | 1. próba: egy fogalom mappánként                                                                                                                                                                                                                                                                                                             |
| `core/src/**` (hat téma, 2 és 6 fájl között)                                                    | 24              | 1. és 2. próba: a csomag már ma kétszintű, tárgykörönként egy vagy két témával                                                                                                                                                                                                                                                               |
| `minimax-client/src/**`, `firecrawl-client/src/**`                                              | 19, 13          | 1. próba: mappánként egy fogalom, a SPEC-002 5.10 és 5.11 szekció szerint                                                                                                                                                                                                                                                                    |
| `agent-tool-bundle/src/**`, `mcp-tool-kit/src/**`, a három `tool-*` csomag, `provider-registry` | 11, 5, 3+3+3, 2 | 1. próba, mind a legfeljebb 5 fájlos mappák                                                                                                                                                                                                                                                                                                  |
| `typeguards/src/**` (17 mappa)                                                                  | 37              | SPEC-002 6.1 utolsó bekezdése kimondja: "A `packages/typeguards` jelenlegi szerkezete helyes és marad", mert ott **egy typeguard típus maga egy téma**                                                                                                                                                                                       |
| `tooling/scripts/src/**`, `tooling/eslint-config/src/**`                                        | 10, 4           | 1. próba; a `casing/` mappa útvonalára a SPEC-002 35. kritériuma külön garanciát ad, hogy nem változik                                                                                                                                                                                                                                       |
| `tools/wire-probe/src/**`                                                                       | 48              | Hatókörön kívül, SPEC-002 6.8: nem termékkód, az npm scriptek konkrét fájlutakat hívnak, és a `src/cases/` 37 fájlja egy fogalom egy mappában                                                                                                                                                                                                |
| `apps/web/src/main.ts`                                                                          | 1               | Hatókörön kívül, SPEC-002 6.8: a Vite belépési pontját három, egymástól független dolog rögzíti ezen az útvonalon                                                                                                                                                                                                                            |
| `apps/*`, `agent`, `engine`, `logger`, `protocol`, `ui`                                         | 0               | nincs mit rendezni, placeholder `index.ts` áll bennük                                                                                                                                                                                                                                                                                        |

## 6. Kockázat és költség

### 6.1 A mozgás mérete, megszámolva

| Amit mértem                                         | Érték | Hogyan                                                                                                                                                                                                                            |
| --------------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| mozduló fájl                                        | 57    | 24 + 18 + 15, a három érintett mappa teljes tartalma                                                                                                                                                                              |
| érintetlen fájl a `db` csomagban                    | 51    | 107 mínusz 57, plusz a barrel                                                                                                                                                                                                     |
| érintett csomag                                     | 1     | `packages/db`                                                                                                                                                                                                                     |
| átírandó import sor a három mappán **belül**        | 64    | ebből 18 új téma közti hivatkozás, 46 egy `../` szinttel mélyebb lesz                                                                                                                                                             |
| változatlan import sor a három mappán belül         | 72    | témán belül maradó `./` hivatkozás                                                                                                                                                                                                |
| átírandó import sor a `db` csomag többi részéből    | 43    | 13 fájlban: `workflow-run/` 19 sor, `step-run/` 9, `human-approval/` 6, `run-recovery/` 5, `sqlite-connection/` 4. Az `app-setting/`, a `provider-concurrency/`, a `database-file/` és a `migration/` mappa nulla sorral érintett |
| átírandó sor a `src/index.ts` barrelben             | 4     | `workflow-repository.ts`, `run-event-repository.ts`, `run-event-kind.ts`, `is-run-event-kind.ts`                                                                                                                                  |
| átírandó sor a `drizzle.config.ts` séma listájában  | 5     | 3 a `workflow-graph`, 1 a `graph-snapshot`, 1 a `run-event` mappából                                                                                                                                                              |
| **átírandó import és export specifikátor összesen** | 111   | 64 + 43 + 4                                                                                                                                                                                                                       |
| érintett `CLAUDE.md` tábla sor                      | 3     | `packages/db/CLAUDE.md` `## Fájlok`, a három érintett mappa sora                                                                                                                                                                  |

A 4.4 két külön eldöntendő javaslata ehhez további 3 fájl mozgást (`barrel-exports.spec.ts`,
`is-string-array.ts`, `is-string-array.spec.ts`) és 4 import sort ad.

### 6.2 A `drizzle.config.ts` séma fájl listája

A `packages/db/drizzle.config.ts` **explicit fájllistát** használ, nem globot, és a fájl saját
kommentje mondja meg, miért: a `./src/**/*.ts` glob a `.spec.ts` fájlok `vitest` importján
elhasal a drizzle-kit esbuild alapú CJS bundlerében, és a negációs minta nem szűri ki (a
hivatalos `drizzle.config.ts` doksi `schema` szekciója sem dokumentál negációs mintát,
https://orm.drizzle.team/docs/drizzle-config-file#schema).

Ebből az következik, hogy **a tábla fájlok mozgatása kötelezően együtt jár az öt sor
átírásával**:

| Jelenlegi sor                              | Új sor                                                     |
| ------------------------------------------ | ---------------------------------------------------------- |
| `'./src/workflow-graph/workflow.ts'`       | `'./src/workflow-graph/workflow/workflow.ts'`              |
| `'./src/workflow-graph/workflow-node.ts'`  | `'./src/workflow-graph/workflow/workflow-node.ts'`         |
| `'./src/workflow-graph/workflow-edge.ts'`  | `'./src/workflow-graph/workflow/workflow-edge.ts'`         |
| `'./src/graph-snapshot/graph-snapshot.ts'` | `'./src/graph-snapshot/stored-snapshot/graph-snapshot.ts'` |
| `'./src/run-event/run-event.ts'`           | `'./src/run-event/event-record/run-event.ts'`              |

A fájl fejlécének utolsó mondatát ("új téma mappa új tábla fájlja esetén ide is fel kell
venni") a kétszintű alakra kell pontosítani.

**Ha egy sor kimarad, azt a `bun run check:db-drift` kapu fogja el, nem csendben:** a
drizzle-kit a hiányzó fájl tábláját nem látja, ezért a `generate` egy `DROP TABLE` migrációt
írna a `packages/db/drizzle/` mappába, a wrapper pedig `git status --porcelain` alapon
driftet jelent és nem nulla kóddal lép ki. Ez a terv legfontosabb gépi védőhálója.

### 6.3 A git index betűzése

| Kockázat                                                                                                      | Védelem                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A fájlrendszer itt nem kis és nagybetű érzékeny, egy rossz átnevezés a git indexben a régi betűzésen maradhat | Minden mozgatás **`git mv`**, nem kézi törlés és újralétrehozás. Minden fázis végén `bun run check:casing`, ami a git indexben tárolt fájlneveket veti össze a rájuk mutató relatív importok betűzésével                                                         |
| Kis-nagybetű különbség egy új mappanévben                                                                     | Mind a tíz új mappanév új, kebab-case, és egyik sem különbözik csak betűzésben egy meglévőtől: `workflow`, `node-type`, `node-config`, `agent-step-config`, `stored-snapshot`, `snapshot-document`, `snapshot-hash`, `event-record`, `event-kind`, `sdk-message` |

### 6.4 A többi kapu és eszköz érintettsége

| Eszköz                                                    | Érintett | Miért                                                                                                                                                                                                                       |
| --------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run check:graph`                                     | nem      | csomag szintű: a `package.json` `dependencies` mezőit és a `package-layer.ts` réteg térképet nézi. Csomag nem keletkezik és nem szűnik meg, függőség nem változik                                                           |
| `bun run docs:check`                                      | nem      | a `git ls-files '*/package.json'` csomaggyökereit nézi, és azt, hogy van-e ott `CLAUDE.md`. Új csomaggyökér nincs, téma mappa nem kap `CLAUDE.md`-t (SPEC-002 6.7)                                                          |
| `packages/db/CLAUDE.md`                                   | igen     | a `## Fájlok` tábla a **téma mappákat** sorolja fel, kétszintű csomagban a tárgykörrel együtt (SPEC-002 6.7). A három érintett sorból tíz lesz. Ezt a `docs:check` nem ellenőrzi, a SPEC-002 19. kritériuma viszont előírja |
| `src/index.ts` barrel                                     | igen     | négy `export ... from './<mappa>/...'` sor útvonala mélyül. A barrel **tartalma nem változik**: ugyanaz a szimbólumlista, ugyanabban a sorrendben                                                                           |
| `sqlite-connection/barrel-exports.spec.ts`                | nem      | a barrel exportlistáját nézi, nem az útvonalakat; a szimbólumlista változatlan                                                                                                                                              |
| `turbo.json`                                              | nem      | az `inputs` minták `packages/*/src/**` alakúak, mélységfüggetlenek                                                                                                                                                          |
| `vitest.config.ts`                                        | nem      | a `projects` glob `packages/*`, a teszt minta `**/*.{test,spec}.ts`, a `coverage.include` `packages/*/src/**/*.{ts,tsx}`; mindhárom mélységfüggetlen                                                                        |
| `coverage.exclude`                                        | nem      | egyetlen sorral sem bővül, a SPEC-002 22. kritériuma szerint                                                                                                                                                                |
| `eslint.config.ts`                                        | nem      | a szabálykészlet fájlmintái mélységfüggetlenek                                                                                                                                                                              |
| `.github/workflows/ci.yml`                                | nem      | gyökér npm scripteket hív                                                                                                                                                                                                   |
| `docs/research/2026-08-27-spec003-f1-nyitott-kerdesek.md` | nem      | három sorban említi a régi útvonalakat, de az historikus mérési szöveg. A SPEC-002 1. kritériuma ugyanezt az elvet alkalmazta: a `docs/` alatti historikus szöveget nem írjuk át                                            |

### 6.5 Tartalmi kockázatok

| Kockázat                                                                                 | Hatás                                     | Védelem                                                                                                                                            |
| ---------------------------------------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Egy import specifikátor rossz mélységgel marad                                           | `TS2307`, a fázis nem zárható             | `bun run typecheck` és `bun run lint` (`import-x/no-unresolved`) minden fázis végén                                                                |
| Egy tábla fájl kimarad a `drizzle.config.ts` listából                                    | csendben `DROP TABLE` migráció keletkezne | `bun run check:db-drift`, lásd 6.2                                                                                                                 |
| A lefedettség elmozdul                                                                   | a `test` kapu elbukik                     | egyetlen futásidejű sor sem változik, a `.spec.ts` fájlok a párjukkal együtt költöznek; a teszt darabszám a fázis előtt és után azonos kell legyen |
| A `graph-snapshot` fixture lenyomat literálja elmozdul                                   | a kanonizálás észrevétlen változása       | a fixture és a spec ugyanabba a `snapshot-hash/` mappába kerül, a tartalmuk nem változik; a spec a fázis végén zöld                                |
| A mappa szintű import irány a `node-config` és az `agent-step-config` között visszamutat | a fa félrevezet, gépi kapu nem bukik      | 4.5 szekció: a fájl a `typeguards` csomagba kerül, vagy a fallback ág marad, kimondott következménnyel                                             |
| Turborepo cache találat elfedi a hibát                                                   | zöld kapu piros kód mellett               | a `db` csomag `src/**` fája az `inputs` része, tehát minden fázis invalidálja a `typecheck` és a `lint` taskot                                     |

## 7. Végrehajtási fázisok

Minden fázis után **mind a nyolc kapu** nulla kilépési kóddal fut, és a fázis csak ezután
commitolható. A kapuk a PLAN-003 2. szekciója szerint: `typecheck`, `lint`, `format:check`,
`test`, `build`, `docs:check`, `check:casing`, `check:graph`. A `packages/db` érintettsége
miatt ehhez **kilencedikként a `bun run check:db-drift`** is minden fázis végén fut.

| Fázis | Mit                                                                                                                                                             | Függőség | Mozduló fájl | Modell   | Elfogadási kritérium                                                                                                |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------ | -------- | ------------------------------------------------------------------------------------------------------------------- |
| F0    | Kiindulás rögzítése: a kilenc parancs lefuttatása, a `bun run test` teszt fájl és teszt darabszámának, plus a négy lefedettségi metrikának a feljegyzése        | nincs    | 0            | `sonnet` | mind a kilenc zöld, a számok feljegyezve, semmi nem változott a munkafában                                          |
| F1    | SPEC-002 átvezetése a 8. szekció szerint, plusz a gyökér `CLAUDE.md` egy bekezdése. Csak dokumentum, kód nem                                                    | F0       | 0            | `opus`   | `format:check` és `docs:check` zöld, a SPEC-002 6.1, 6.2, 6.5 és a 10. kritérium a kétszintű `db` csomaggal is igaz |
| F2    | `src/run-event/` -> `event-record/`, `event-kind/`, `sdk-message/`. `git mv`, importok, barrel két sora, `drizzle.config.ts` egy sora, `CLAUDE.md` egy sora     | F1       | 15           | `sonnet` | mind a kilenc kapu zöld, a teszt darabszám azonos az F0 méréssel, a lefedettség 100 százalék mind a négy metrikán   |
| F3    | `src/graph-snapshot/` -> `stored-snapshot/`, `snapshot-document/`, `snapshot-hash/`. `drizzle.config.ts` egy sora, `CLAUDE.md` egy sora                         | F2       | 18           | `sonnet` | ugyanaz, plusz a fixture lenyomat spec változatlan literállal zöld                                                  |
| F4    | `src/workflow-graph/` -> `workflow/`, `node-type/`, `node-config/`, `agent-step-config/`. `drizzle.config.ts` három sora, barrel egy sora, `CLAUDE.md` egy sora | F3       | 24           | `sonnet` | ugyanaz                                                                                                             |
| F5    | A 4.4 két külön eldöntendő javaslata, **csak ha a user jóváhagyta**: `barrel-exports.spec.ts` saját mappába, `isStringArray` a `typeguards` csomagba            | F4, user | 3            | `sonnet` | ugyanaz, plusz a `typeguards` barrel és `CLAUDE.md` bővült, és a `db` három importja csomagnév szerintire váltott   |
| F6    | Zárás: `packages/db/CLAUDE.md` `## Fájlok` táblájának végső átolvasása, a terv és a valóság összevetése fájlonként                                              | F5       | 0            | `opus`   | mind a 107 `db` fájl elszámolt, egyetlen fájl sem maradt leképezés nélkül, mind a kilenc kapu zöld                  |

**Végrehajtás állapota.** F1: kész (a SPEC-002, a SPEC-003 és a `.claude/CLAUDE.md` átvezetve).
F2: kész (`run-event/` -> `event-record/`, `event-kind/`, `sdk-message/`, 15 fájl, mind a
kilenc kapu zöld, 912 teszt, 100% lefedettség).
F3: kész (`graph-snapshot/` -> `stored-snapshot/`, `snapshot-document/`, `snapshot-hash/`,
18 fájl, mind a kilenc kapu zöld, 912 teszt, 100% lefedettség).
F4: kész (`workflow-graph/` -> `workflow/`, `node-type/`, `node-config/`, `agent-step-config/`,
24 fájl, az `is-string-array.ts` egyelőre a `node-config/` alatt, a 4.5 szekció szerinti
fallback helyen, mind a kilenc kapu zöld, 912 teszt, 100% lefedettség).

**Miért ebben a sorrendben.** A három bontás növekvő méretben követi egymást (15, 18, 24),
és a legkisebbnek a legkevesebb kifelé mutató éle van, tehát ott derül ki legolcsóbban, ha
egy lépés hibás. A SPEC-002 átvezetése azért előzi meg a mozgatást, mert a spec a szerződés:
kód nem állhat olyan alakban, amit a saját specje tilt.

**Pusholni nem tudok.** Minden fázis commitja után a usernek kell pusholnia, a
`feat/spec-003-domain-perzisztencia` ágon.

## 8. Amit a SPEC-002-ben át kell vezetni

A terv a rögzített konvención **finomít**, nem írja felül. A konvenció két alapelve
változatlan: a tagolás téma szerinti, nem technikai réteg szerinti, és a mappafa legfeljebb
kétszintű. Ami változik, az a **második szint kiváltó oka**: eddig kizárólag az volt, hogy a
csomag több, korábban önálló tárgykört fog össze; ehhez jön az az eset, hogy egyetlen
tárgykör maga több, önállóan megnevezhető fogalmat hordoz.

Az alábbi szekciókat és kritériumokat kell átvezetni. **Ez a terv nem írja át a SPEC-002-t**,
csak felsorolja, mit kell.

| Hely                         | Ma mit mond                                                                                              | Mit kell átvezetni                                                                                                                                                               |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **6.1 pont, 8. szabály**     | "kétszintű ott, ahol a csomag több tárgykört fog össze"                                                  | a második kiváltó ok felvétele: kétszintű ott is, ahol egyetlen tárgykör több, önállóan megnevezhető fogalmat hordoz. A 3. szekció bontási próbája a szabály tartalmi mércéje    |
| **6.1 pont, 8. szabály**     | "Ha több, akkor **minden** tárgykör kap egy `src/<tárgykör>/` mappát"                                    | a vegyes alak kimondása: a `provider-capability` mai állapota (téma mappák és tárgykör mappák egymás mellett) megengedett, és a `db` ugyanezt teszi majd                         |
| **6.1 pont, felsorolás**     | "A 8. szabály alá eső két csomag, tételesen" plusz a `core` és a `provider-capability` fája              | harmadik blokkal bővül: a `packages/db` fája a három tárgykörrel és a kilenc lapos témával                                                                                       |
| **6.2 pont, 5. szabály**     | "A repóban kettő ilyen van" (megvalósítás nélküli regressziós teszt)                                     | három van: a SPEC-003 óta a `packages/db/src/.../barrel-exports.spec.ts` is ilyen. A 4.4 javaslata ezt a szabályhoz igazítja                                                     |
| **6.5 pont, Fő szabály**     | "A 19 termékcsomagból 17 egy tárgykörű ... Kettő kétszintű, a `core` és a `provider-capability`"         | 16 és három: a `db` a harmadik kétszintű csomag                                                                                                                                  |
| **10. elfogadási kritérium** | "Kétszintű pontosan két csomag, a `core` és a `provider-capability` ... a maradék 17 termékcsomag lapos" | három csomag, `core`, `provider-capability`, `db`; a maradék 16 lapos. A "legfeljebb kétszintű" és a "duplikált mappaszint sehol" rész **változatlan**                           |
| **8. elfogadási kritérium**  | "a keletkezett téma mappák halmaza ... az 5. szekció táblázataiban felsorolt 45 téma mappával"           | nem változik. Az 5. szekció a SPEC-002 migrációjának csomagjairól szól, a `db` nincs benne; a `db` téma mappáinak forrása a SPEC-003 8. szekció, illetve mostantól ez a PLAN-004 |
| **7. elfogadási kritérium**  | `find ... -maxdepth 3 -type f -name '*.ts' -not -name 'index.ts'` üres eredményt ad                      | nem változik: a parancs a `src/` **közvetlen** gyermekeit nézi, a mélyebb szinteket nem érinti. A `db` új fája ezt továbbra is teljesíti                                         |
| **SPEC-003 8. szekció**      | "12 téma mappa" a `packages/db` csomagban                                                                | pontosítás: kilenc téma mappa és három tárgykör mappa, összesen tíz témával a három tárgykör alatt                                                                               |
| **gyökér `CLAUDE.md`**       | "Ilyen pontosan kettő van: a `core` ... és a `provider-capability`"                                      | harmadikként a `db`, egy mondattal, a részletekért erre a PLAN-004-re és a SPEC-002 6. szekcióra hivatkozva                                                                      |
| **`packages/db/CLAUDE.md`**  | a `## Fájlok` tábla három sora a három lapos mappáról                                                    | a három sor helyére `<tárgykör>/<téma>/` alakú sorok, a SPEC-002 6.7 pontja szerint                                                                                              |

**Amit szándékosan NEM javaslok megváltoztatni:**

- A harmadik szint tilalmát. A `db` új fája sehol nem éri el, és a "ha harmadik szint kellene,
  az azt jelenti, hogy a csomag két csomag" próba továbbra is hasznos.
- A tiltott mappaneveket (6.5). A tíz új mappanév mind domain fogalom.
- A 6.8 két kivételét (`apps/web/src/main.ts`, `tools/wire-probe`). Mindkettő indoka
  érvényes, és a leltár szerint egyikben sincs olyan mappa, amit a 3. szekció próbája
  bontásra jelölne.
- A `typeguards` csomag szerkezetét, amit a 6.1 utolsó bekezdése kifejezetten helyesnek mond.

## 9. Kapcsolódó dokumentumok

- [`../spec/SPEC-002-csomag-architektura.md`](../spec/SPEC-002-csomag-architektura.md): a mappa konvenció és a csomagnév konvenció forrása
- [`../spec/SPEC-003-domain-perzisztencia.md`](../spec/SPEC-003-domain-perzisztencia.md): a `packages/db` csomag tartalmának specifikációja
- [`PLAN-003-domain-perzisztencia.md`](PLAN-003-domain-perzisztencia.md): a nyolc minőségi kapu és a `db` téma mappák eredeti bontása
- [`../research/2026-08-27-spec003-f1-nyitott-kerdesek.md`](../research/2026-08-27-spec003-f1-nyitott-kerdesek.md): az O-8 szekció, ami a `drizzle.config.ts` explicit fájllistáját indokolja
