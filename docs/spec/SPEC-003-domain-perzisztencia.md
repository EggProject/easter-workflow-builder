# SPEC-003: Domain modell és perzisztencia

|          |                                                                                                                                                                                                                                                                              |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Státusz  | tervezet                                                                                                                                                                                                                                                                     |
| Dátum    | 2026-08-27                                                                                                                                                                                                                                                                   |
| Előzmény | [`SPEC-002-csomag-architektura.md`](SPEC-002-csomag-architektura.md) 6. szekció (mappa konvenció), 4. szekció (rétegzés)                                                                                                                                                     |
| Bemenet  | [`../research/2026-08-26-agent-sdk-minimax.md`](../research/2026-08-26-agent-sdk-minimax.md), [`../research/2026-08-26-spec000-kiertekeles.md`](../research/2026-08-26-spec000-kiertekeles.md), [`../research/2026-08-26-toolchain.md`](../research/2026-08-26-toolchain.md) |
| Kimenet  | 10 tábla a `@easter-workflow-builder/db` csomagban, 12 téma mappa, verziózott gráf pillanatkép, két állapotgép, repository réteg                                                                                                                                             |
| Terv     | [`../plan/PLAN-003-domain-perzisztencia.md`](../plan/PLAN-003-domain-perzisztencia.md)                                                                                                                                                                                       |

---

## 1. Cél és hatókör

### Amit eldönt

- A workflow, a futás, a lépés futás, az esemény és az emberi jóváhagyás domain entitásait, a mezőikkel, kötelezőségükkel, idegen kulcsaikkal, kaszkád viselkedésükkel és indexeikkel.
- A gráf pillanatkép alakját, a séma verziózását és azt, mi garantálja a régi futás megjeleníthetőségét.
- Az esemény tábla normalizált mezőkészletét, a nyers üzenet tárolását, a WebSocket replay sorszámozását.
- A futás és a lépés futás állapotgépét, az érvényes átmeneteket, valamint az újraindítás, megszakítás és szerver leállás viselkedését.
- A `packages/db` csomag téma mappáit, a repository réteg műveleteit és azt, hogyan nem kerülhetők meg a séma garanciái.
- A migrációk generálását és futtatását, az adatbázis fájl helyét, a fejlesztői és az éles viselkedést.
- A tesztelés módját valós SQLite ellen, 100 százalékos lefedettséggel, kizárás nélkül.

### Amit NEM dönt el

- Nem tervezi meg a végrehajtó motort (`@easter-workflow-builder/engine`), a HTTP és WebSocket felületet (`apps/server`, `@easter-workflow-builder/protocol`), sem a gráf szerkesztő UI-t (`apps/web`, `@easter-workflow-builder/ui`). A jelen spec csak azt rögzíti, milyen adatot kell tudni kiolvasni és beírni.
- Nem nyúl a provider config fájlokhoz és nem vezet be provider CRUD felületet. A DB kizárólag azonosítóval hivatkozik providerre.
- Nem old fel egyetlen SPEC-000 mérési eredményt sem, és nem ír új drótszintű mérést.
- Nem vezet be adatmegőrzési (retention), tömörítési vagy `VACUUM` szabályt. Erre nincs mérésünk, lásd 13. szekció.
- Nem tervez felhasználó kezelést, jogosultságot vagy több felhasználós működést. A rendszer egy felhasználós, egy szerver folyamatos, ez rögzített feltevés (7.4).

### A user négy döntése, amit ez a spec megvalósít

| #   | Döntés                                       | Hol valósul meg                                                   |
| --- | -------------------------------------------- | ----------------------------------------------------------------- |
| 1   | Minden futás pillanatképet tárol a gráfról   | 5. szekció, `run_graph_snapshot` tábla, verziózott dokumentummal  |
| 2   | Nyers SDK üzenet plusz normalizált mezők     | 6. szekció, `run_event` tábla                                     |
| 3   | Végleges törlés mindennel együtt             | 4.11 szekció, `ON DELETE CASCADE` lánc, soft delete nélkül        |
| 4   | Közös, providerenkénti párhuzamossági korlát | 11. szekció, `provider_concurrency_limit` tábla, alapérték nélkül |

## 2. Megerősített tények, forrással

Ez a szekció az a tényalap, amire a séma épül. Minden sor mögött hivatalos dokumentáció vagy a ténylegesen kiadott csomagforrás áll. Amire nincs forrás, az a 13. szekcióban áll nyitott kérdésként.

| #    | Tény                                                                                                                                                                                                              | Forrás                                                                                                                                                                                            |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-1  | SQLite: az idegen kulcs kikényszerítés alapból KI van kapcsolva, és **kapcsolatonként** kell bekapcsolni `PRAGMA foreign_keys = ON` paranccsal                                                                    | https://sqlite.org/foreignkeys.html                                                                                                                                                               |
| F-2  | A `foreign_keys` pragma többutasításos tranzakción **belül hatástalan**, csendben no-op                                                                                                                           | https://sqlite.org/foreignkeys.html                                                                                                                                                               |
| F-3  | `better-sqlite3` nem kapcsolja be magától az idegen kulcsokat, a `.pragma()` API-t adja hozzá                                                                                                                     | https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md                                                                                                                                |
| F-4  | `better-sqlite3` szinkron API, támogatja a `:memory:` adatbázist, a `.transaction()` BEGIN/COMMIT/ROLLBACK szemantikájú, `.immediate()` és `.exclusive()` variánssal                                              | https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md                                                                                                                                |
| F-5  | `better-sqlite3` `options.timeout` dokumentált alapértéke 5000 ms, ez a busy handler                                                                                                                              | https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md, https://sqlite.org/c3ref/busy_timeout.html                                                                                    |
| F-6  | SQLite alapértelmezett `journal_mode` = `DELETE`, a WAL bekapcsolása `PRAGMA journal_mode = WAL`                                                                                                                  | https://sqlite.org/wal.html                                                                                                                                                                       |
| F-7  | `:memory:` adatbázison a `journal_mode` csak `MEMORY` vagy `OFF` lehet, a WAL-ra állítás **figyelmen kívül marad**                                                                                                | https://sqlite.org/pragma.html#pragma_journal_mode                                                                                                                                                |
| F-8  | WAL módban is egyszerre **egy** író lehet                                                                                                                                                                         | https://sqlite.org/wal.html                                                                                                                                                                       |
| F-9  | `INTEGER PRIMARY KEY` (rowid alias) újrahasznosíthatja a törölt legnagyobb rowid értéket; az `AUTOINCREMENT` `sqlite_sequence` alapján **soha nem használt, monoton növekvő** értéket ad, hézagokkal              | https://sqlite.org/autoinc.html                                                                                                                                                                   |
| F-10 | UNIQUE indexben minden NULL érték különbözőnek számít, tehát több NULL megengedett                                                                                                                                | https://www.sqlite.org/lang_createindex.html                                                                                                                                                      |
| F-11 | Az `ON DELETE CASCADE` láncoltan és önhivatkozó táblán is működik; a `PRAGMA recursive_triggers` **nem** befolyásolja; van dokumentált mélységi korlát (`SQLITE_MAX_TRIGGER_DEPTH`, `SQLITE_LIMIT_TRIGGER_DEPTH`) | https://www.sqlite.org/foreignkeys.html, https://www.sqlite.org/pragma.html#pragma_recursive_triggers                                                                                             |
| F-12 | `CREATE TABLE` hivatkozhat még nem létező szülő táblára, a hiba csak DML-nél jelentkezik                                                                                                                          | https://www.sqlite.org/foreignkeys.html                                                                                                                                                           |
| F-13 | Drizzle 0.45.2 SQLite: `integer().primaryKey({ autoIncrement: true })` létezik és `AUTOINCREMENT` kulcsszót generál                                                                                               | https://unpkg.com/drizzle-orm@0.45.2/sqlite-core/columns/integer.d.ts, https://orm.drizzle.team/docs/sqlite/column-types                                                                          |
| F-14 | Drizzle 0.45.2 SQLite: a `sqliteTable` harmadik paramétere **tömböt** visszaadó callback; az objektumot visszaadó alak `@deprecated`                                                                              | https://unpkg.com/drizzle-orm@0.45.2/sqlite-core/table.d.ts                                                                                                                                       |
| F-15 | Drizzle 0.45.2 SQLite: `references(ref, { onDelete: 'cascade' })` létezik, az `IndexBuilder` ad `.where()` metódust (részleges index), és van `check(name, sql)` a tábla extra configban                          | https://unpkg.com/drizzle-orm@0.45.2/sqlite-core/columns/common.d.ts, https://unpkg.com/drizzle-orm@0.45.2/sqlite-core/indexes.d.ts, https://unpkg.com/drizzle-orm@0.45.2/sqlite-core/checks.d.ts |
| F-16 | Drizzle 0.45.2 SQLite: `integer({ mode: 'timestamp' })` **másodpercet** tárol (`Math.floor(unix/1000)`), `{ mode: 'timestamp_ms' }` **ezredmásodpercet**; `text({ mode: 'json' })` és `.$type<T>()` létezik       | https://unpkg.com/drizzle-orm@0.45.2/sqlite-core/columns/integer.js                                                                                                                               |
| F-17 | Drizzle SQLite: **nincs** natív `STRICT` tábla támogatás, sem a `sqliteTable` configban, sem a drizzle-kitben                                                                                                     | https://unpkg.com/drizzle-orm@0.45.2/sqlite-core/table.d.ts, https://github.com/drizzle-team/drizzle-orm/discussions/2435                                                                         |
| F-18 | `drizzle-orm/better-sqlite3/migrator` `migrate()` **szinkron**, és a `__drizzle_migrations` táblába naplóz (a név `migrationsTable`-lel felülírható)                                                              | https://unpkg.com/drizzle-orm@0.45.2/sqlite-core/dialect.js                                                                                                                                       |
| F-19 | `drizzle-kit generate` a séma és az utolsó snapshot diffjéből ír SQL migrációt; a `--custom` kapcsoló üres migrációt generál nyers SQL-hez; a `check` a migrációtörténet konzisztenciáját nézi                    | https://orm.drizzle.team/docs/sqlite/drizzle-kit-generate, https://orm.drizzle.team/docs/sqlite/drizzle-kit-check                                                                                 |
| F-20 | `better-sqlite3` nem szállít saját TypeScript típust, kell hozzá `@types/better-sqlite3`                                                                                                                          | https://registry.npmjs.org/better-sqlite3/latest, https://registry.npmjs.org/@types/better-sqlite3/latest                                                                                         |

Az F-17 következménye, hogy a típus szigorúságot a séma szintjén nem kapjuk meg SQLite oldalról, tehát a repository réteg typeguardjai nem díszítés, hanem az egyetlen szűrő a bejövő értékeken.

Az SDK oldali tények (az `SDKMessage` unió, a session kezelés, a hookok, a `usage` mezők) a research fájlokból jönnek, és a 6. szekció táblázata hivatkozza őket mezőnként. Amit a research nem támaszt alá, az ebben a specben nem szerepel.

## 3. Entitás áttekintés

Tíz saját tábla, plusz a drizzle-kit által kezelt `__drizzle_migrations` (F-18), ami nem a mi sémánk része.

```
workflow  1 --- n  workflow_node
workflow  1 --- n  workflow_edge   (source_node_id, target_node_id -> workflow_node)
workflow  1 --- n  workflow_run
workflow_run  1 --- 1  run_graph_snapshot
workflow_run  1 --- n  step_run
workflow_run  1 --- n  run_event
workflow_run  1 --- n  human_approval
workflow_run  1 --- n  workflow_run       (root_run_id, al-workflow futasok)
step_run      1 --- n  step_run           (parent_step_run_id, vegrehajtasi fa)
step_run      0 --- 1  workflow_run       (sub_workflow_run_id, al-workflow hivas)
step_run      1 --- n  run_event
step_run      0 --- 1  human_approval

app_setting                     egysoros, globalis alapertelmezesek
provider_concurrency_limit      providerenkent legfeljebb egy sor
```

**Az irány egyirányú.** A `workflow_run` táblának nincs idegen kulcsa a `step_run` felé, a kapcsolatot a `step_run.sub_workflow_run_id` hordozza. Ez azért fontos, mert így a tábla létrehozási sorrend egyértelmű, és nem kell az F-12 szerinti előre hivatkozásra támaszkodni.

**Azonosító típus.** Minden domain entitás elsődleges kulcsa `TEXT`, az alkalmazás által generált UUID, egyetlen kivétellel: a `run_event.id` `INTEGER PRIMARY KEY AUTOINCREMENT` (F-9, F-13), mert ott a szigorúan monoton, soha újra nem használt sorszám maga a funkció (6.3). A UUID azért kell a többinél, mert a gráf pillanatkép a node azonosítókat szövegként hordozza, és a kliens már a szerver válasza előtt hivatkozni tud rájuk.

**Időbélyeg típus.** Minden időbélyeg `integer({ mode: 'timestamp_ms' })`, tehát Unix ezredmásodperc (F-16). Másodperc felbontás nem elég: egy agent lépés alatt másodpercen belül több `stream_event` érkezik, és a transcript sorrendje nem dőlhet el időbélyeg egyenlőségen. A sorrendet amúgy sem az időbélyeg adja, hanem a `run_event.id` (6.3), az időbélyeg megjelenítési és statisztikai mező.

**Logikai érték.** `integer({ mode: 'boolean' })` (F-16).

**JSON oszlop.** `text({ mode: 'json' }).$type<unknown>()` (F-16). A `$type` szándékosan `unknown`, nem a domain típus: az adatbázisból jövő érték nem bizonyíték a típusra, a szűkítést typeguard végzi a repository határon (9.4).

## 4. Entitások mezőnként

A `nem` a "nem kötelező" (nullable) rövidítése. Az `időbélyeg` típus mindenhol `integer timestamp_ms`.

### 4.1 `workflow`

| Oszlop          | Típus     | Kötelező | Megjegyzés                                                                   |
| --------------- | --------- | -------- | ---------------------------------------------------------------------------- |
| `id`            | text      | igen     | elsődleges kulcs, UUID                                                       |
| `name`          | text      | igen     | a felhasználó által adott név                                                |
| `description`   | text      | nem      |                                                                              |
| `provider_id`   | text      | nem      | workflow szintű provider felülírás; NULL esetén a globális alapértelmezés él |
| `created_at_ms` | időbélyeg | igen     |                                                                              |
| `updated_at_ms` | időbélyeg | igen     |                                                                              |

Index: `workflow_updated_at_idx` a `(updated_at_ms)` oszlopon, a lista nézet rendezéséhez.

A `provider_id` oszlopon **nincs** `CHECK` constraint a provider azonosítók felsorolásával. Indok: egy új provider felvétele akkor migrációt igényelne, holott a provider lista backend config fájlokban él. Az érvényességet a repository határon a `ProviderId` typeguard adja (9.4).

### 4.2 `workflow_node`

| Oszlop          | Típus     | Kötelező | Megjegyzés                                                    |
| --------------- | --------- | -------- | ------------------------------------------------------------- |
| `id`            | text      | igen     | elsődleges kulcs, UUID                                        |
| `workflow_id`   | text      | igen     | FK `workflow.id`, `ON DELETE CASCADE`                         |
| `type`          | text      | igen     | `NodeType` unió, lásd 4.3                                     |
| `label`         | text      | igen     | a rajzon megjelenő felirat                                    |
| `position_x`    | real      | igen     | a gráf szerkesztő koordinátája                                |
| `position_y`    | real      | igen     |                                                               |
| `config`        | text json | igen     | a node típusához tartozó beállítás, `unknown` a séma szintjén |
| `created_at_ms` | időbélyeg | igen     |                                                               |
| `updated_at_ms` | időbélyeg | igen     |                                                               |

Index: `workflow_node_workflow_idx` a `(workflow_id)` oszlopon.

**Miért egy JSON oszlop és nem oszlop minden beállításnak.** Az agent lépés beállításai az Agent SDK `Options` mezőit követik, a mezőlista pedig SDK verzióhoz kötött és bővül (research, 3. szekció: "a body mezők listája nyílt és verziónként bővül"). Oszlopokra bontva minden SDK frissítés migrációt kényszerítene ki, és a régi futások pillanatképe akkor is a régi mezőkészletet hordozná. A JSON oszlop plusz a repository határon futó typeguard ugyanazt a szigort adja TypeScript oldalon, migráció nélkül.

### 4.3 Node típusok és a `config` unió

A `NodeType` unió a felhasználó által jóváhagyott tíz típus:

| `type`           | Felelősség                                        | A `config` lényegi mezői                                                                         |
| ---------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `start`          | belépési pont, bemeneti séma                      | `inputFields: readonly { name, label, valueKind, required }[]`                                   |
| `agent_step`     | a fő típus, egy agent futtatás                    | `AgentStepConfig`, lásd 4.4                                                                      |
| `branch`         | determinisztikus elágazás, **nem** AI             | `expression: string`, `branches: readonly { key, label }[]`, `defaultBranchKey: string \| null`  |
| `fan_out`        | párhuzamos ágak nyitása                           | `itemsExpression: string`, `branchLabelTemplate: string`                                         |
| `join`           | ágak összezárása                                  | `mode: 'merge' \| 'script' \| 'ai_synthesis'`, módonként egy alobjektum                          |
| `loop`           | ciklus vagy retry, iterációszám védelemmel        | `maxIterations: number` (kötelező, alapérték nélkül), `continueExpression: string`               |
| `human_approval` | a futás megáll, amíg a felhasználó nem dönt       | `title: string`, `bodyTemplate: string`                                                          |
| `error_handler`  | hibakezelés és retry policy                       | `maxAttempts: number` (kötelező), `backoffMs: readonly number[]` (kötelező), `handledErrorKinds` |
| `sub_workflow`   | másik workflow hívása, rekurzióvédelemmel         | `targetWorkflowId: string`, `inputMapping: Readonly<Record<string, string>>`                     |
| `script`         | nem AI transzformáció, **később implementálandó** | `source: string`, `runtime: 'expression'`                                                        |

A `join` `ai_synthesis` módja **teljes értékű agent lépés**: az alobjektuma pontosan az `AgentStepConfig` (4.4). A `merge` mód alobjektuma a bemenő ágak összefűzési szabálya, a `script` mód alobjektuma ugyanaz a `ScriptConfig`, mint a `script` node-é.

**A `script` node és a `join` `script` módja tárolható, de nem futtatható.** A séma felkészül rá, a felület kiválaszthatóvá teszi, és modal ablakban "Később implementálandó" jelzést ad. A futás indításakor a validáció elutasítja azt a workflow-t, amiben `script` típusú node vagy `script` módú `join` van, `unimplemented_node_type` hibával. Ez a DB-ben nem `CHECK` constraint, mert a node mentése megengedett, csak a futás indítása nem.

**Iterációszám és retry darabszám.** A `loop.maxIterations`, az `error_handler.maxAttempts` és a `backoffMs` lista **kötelező, szállított alapérték nélkül**. A felhasználó adja meg őket a szerkesztőben. Nincs olyan mérésünk vagy dokumentált szabályunk, amiből ezekre értéket lehetne javasolni, és a projekt szabálya tiltja a becslést. A séma annyit kényszerít ki, ami definíció szerint igaz: az értékek egésznek és pozitívnak kell lenniük, ezt a bemeneti typeguard ellenőrzi.

### 4.4 `AgentStepConfig`

Az agent lépés beállításai. Minden mező forrása az Agent SDK `Options` típusa, ahogy a research 1. szekciója felsorolja. Egyetlen mező sincs kitalálva.

| Mező                              | Típus                                                      | Megjegyzés                                              |
| --------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------- |
| `promptTemplate`                  | `string`                                                   | a lépés bemenete, sablonozva a futás kontextusából      |
| `providerId`                      | `ProviderId \| null`                                       | lépés szintű provider felülírás                         |
| `modelId`                         | `string \| null`                                           | a **wire** modellazonosító, lásd lent                   |
| `effort`, `thinking`              | `string \| null`, `ThinkingMode \| null`                   | `Options.effort`, `Options.thinking`                    |
| `allowedTools`, `disallowedTools` | `readonly string[]`                                        | `Options.allowedTools`, `Options.disallowedTools`       |
| `permissionMode`                  | `string \| null`                                           | `Options.permissionMode`                                |
| `maxTurns`, `maxBudgetUsd`        | `number \| null`                                           | `Options.maxTurns`, `Options.maxBudgetUsd`              |
| `systemPrompt`                    | `string \| { preset, append?, ... } \| null`               | `Options.systemPrompt` két alakja                       |
| `agents`                          | `Readonly<Record<string, AgentDefinition>>`                | `Options.agents`, programozott subagentek               |
| `skills`                          | `readonly string[] \| 'all' \| null`                       | `Options.skills`                                        |
| `mcpServers`                      | `Readonly<Record<string, StorableMcpServer>>`              | csak a szerializálható variánsok, lásd lent             |
| `enabledEngineHooks`              | `readonly EngineHookId[]`                                  | **nem** az SDK `hooks` map, lásd lent                   |
| `cwd`, `additionalDirectories`    | `string \| null`, `readonly string[]`                      | `Options.cwd`, `Options.additionalDirectories`          |
| `sandbox`                         | `SandboxConfig \| null`                                    | `Options.sandbox` mezői a research 1. szekciója szerint |
| `agentTools`                      | `readonly AgentToolId[]`                                   | lépésenként kapcsolható in-process MCP eszközök         |
| `sessionMode`                     | `'isolated' \| 'continued'`                                | lásd 4.5                                                |
| `structuredOutput`                | `{ strategy: StructuredOutputStrategyId, schema } \| null` | lásd 4.6                                                |

**A `modelId` a wire azonosító.** A research 5.1 szekciója szerint a leíró két azonosítót tart külön: a dróton megjelenő `models[].id` és a kliensnek átadott `models[].clientModelIdentifier`. "A UI és a perzisztencia a wire azonosítót mutatja, a kliensnek a suffixes alak megy." A DB tehát a wire azonosítót tárolja, a suffixes alakot a provider leíróból oldja fel a motor.

**Az `mcpServers` nem tartalmazhat titkot.** A tárolható variánsok a `stdio`, `sse` és `http` (research 1. szekció). Az in-process `sdk` variáns nem szerializálható, ezért nem tárolható; az in-process eszközöket az `agentTools` lista adja. A `stdio` variáns `env` mezője helyett a séma **kizárólag `envNames: readonly string[]` értéket tárol**, a `sse` és `http` variáns fejléc értéke helyett `authEnvName: string | null` mezőt. A tényleges értéket a motor a process környezetéből olvassa ki indításkor. Ez a gyökér `CLAUDE.md` "Titok soha nem kerül adatbázisba" szabályának mechanikus megvalósítása.

**Az `enabledEngineHooks` nem az SDK `hooks` mezője.** Az SDK `hooks` opciója callback map (research 1. szekció), tehát nem szerializálható. A DB azt tárolja, hogy a motor melyik saját, beépített hookját kapcsolja be a lépéshez; a motor ebből állítja elő az SDK `hooks` objektumot. Az első verzióban ezt a listát pontosan egy dolog vezérli: az `emit_output_tool` stratégiához tartozó `Stop` hook (4.6).

### 4.5 Session modell

A `sessionMode` két értéke a research 1. szekció "Session kezelés" pontjára képez:

| Érték       | Mit tesz a motor                                                                                                                                |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `isolated`  | friss session, sablonozott bemenet, strukturált kimenet. Nincs `resume`.                                                                        |
| `continued` | `resume: <az előző lépés session azonosítója>`; párhuzamos ágnál ugyanez plusz `forkSession: true`, hogy az eredeti session érintetlen maradjon |

A tényleges session azonosítót a lépés futás rögzíti, nem a node config: a `step_run.sdk_session_id`, a `step_run.resumed_from_session_id` és a `step_run.forked_session` oszlop (4.7). A session azonosító a `system` üzenet `subtype: 'init'` alakjából jön (research 1. szekció).

### 4.6 Strukturált kimenet

A `structuredOutput.strategy` értékkészlete a meglévő `StructuredOutputStrategyId` típus a `@easter-workflow-builder/provider-capability` csomagból: `sdk_output_format` és `emit_output_tool`. A séma nem definiál újat.

A `schema` mező JSON Schema dokumentum, `unknown` a séma szintjén, typeguarddal szűkítve.

**Mért kísérő megkötés, ami validációként épül be.** A research 5.2 szekciója szerint a `maxTurns` legalább 2 kell legyen az `sdk_output_format` ágon (az M-02 futás `maxTurns: 1` mellett `error_max_turns`-be esett), és legalább 3 az `emit_output_tool` ágon (M-19 mért igénye). A futás indítási validáció ezt ellenőrzi, és `insufficient_max_turns` hibával utasít el. Ez a két szám **mérésből** jön, nem becslésből.

### 4.7 `workflow_edge`

| Oszlop           | Típus     | Kötelező | Megjegyzés                                                            |
| ---------------- | --------- | -------- | --------------------------------------------------------------------- |
| `id`             | text      | igen     | elsődleges kulcs, UUID                                                |
| `workflow_id`    | text      | igen     | FK `workflow.id`, `ON DELETE CASCADE`                                 |
| `source_node_id` | text      | igen     | FK `workflow_node.id`, `ON DELETE CASCADE`                            |
| `target_node_id` | text      | igen     | FK `workflow_node.id`, `ON DELETE CASCADE`                            |
| `source_handle`  | text      | nem      | a szerkesztő kimeneti pontja                                          |
| `target_handle`  | text      | nem      | a szerkesztő bemeneti pontja                                          |
| `branch_key`     | text      | nem      | melyik `branch` kimenethez vagy melyik `step_run` állapothoz tartozik |
| `created_at_ms`  | időbélyeg | igen     |                                                                       |

Indexek: `workflow_edge_workflow_idx` a `(workflow_id)`, `workflow_edge_source_idx` a `(source_node_id)`, `workflow_edge_target_idx` a `(target_node_id)` oszlopon.

Az él **nem** hordoz feltétel kifejezést. A feltétel a `branch` node configjában áll, az él csak azt mondja meg, melyik kimeneti ághoz tartozik (`branch_key`). Így egyetlen helyen áll a kifejezés, és nem lehet két él között ellentmondó feltétel.

### 4.8 `workflow_run`

| Oszlop                  | Típus     | Kötelező | Megjegyzés                                                               |
| ----------------------- | --------- | -------- | ------------------------------------------------------------------------ |
| `id`                    | text      | igen     | elsődleges kulcs, UUID                                                   |
| `workflow_id`           | text      | igen     | FK `workflow.id`, `ON DELETE CASCADE`                                    |
| `status`                | text      | igen     | `RunStatus`, lásd 7.1                                                    |
| `input`                 | text json | igen     | a `start` node bemeneti mezőire adott értékek                            |
| `provider_id`           | text      | igen     | a futásra feloldott provider, indításkor befagyasztva                    |
| `root_run_id`           | text      | igen     | FK `workflow_run.id`, `ON DELETE CASCADE`; gyökér futásnál a saját `id`  |
| `depth`                 | integer   | igen     | 0 a gyökér futásnál, al-workflow hívásnál eggyel több                    |
| `workflow_ancestry`     | text json | igen     | a gyökértől idáig vezető `workflow.id` lista, a rekurzióvédelem bemenete |
| `restarted_from_run_id` | text      | nem      | FK `workflow_run.id`, `ON DELETE SET NULL`; újraindítás származása       |
| `created_at_ms`         | időbélyeg | igen     |                                                                          |
| `started_at_ms`         | időbélyeg | nem      | a `running` állapotba lépés ideje                                        |
| `finished_at_ms`        | időbélyeg | nem      | a terminális állapotba lépés ideje                                       |
| `error_kind`            | text      | nem      | gépi hibaosztály, nem szabad szöveg                                      |
| `error_message`         | text      | nem      | a felhasználónak megjelenített üzenet                                    |

Indexek: `workflow_run_workflow_created_idx` a `(workflow_id, created_at_ms)`, `workflow_run_status_idx` a `(status)`, `workflow_run_root_idx` a `(root_run_id)` oszlopon.

**Az al-workflow rekurzióvédelme küszöbszám nélkül működik.** A `workflow_ancestry` a gyökértől idáig vezető workflow azonosítók rendezett listája. Egy `sub_workflow` node indítása előtt a motor megnézi, szerepel-e a cél workflow azonosítója a listában; ha igen, a hívás `workflow_recursion_detected` hibával áll meg. Ez **determinisztikus ciklusfelismerés**, nem mélységi korlát, tehát nem igényel kitalált számot. A `depth` oszlop megjelenítési és diagnosztikai mező, nem korlát.

Az `ON DELETE CASCADE` a `root_run_id` önhivatkozáson azt adja, hogy a gyökér futás törlése az összes al-workflow futását is elviszi, akkor is, ha azok másik workflow-hoz tartoznak (F-11).

### 4.9 `run_graph_snapshot`

| Oszlop             | Típus     | Kötelező | Megjegyzés                                                      |
| ------------------ | --------- | -------- | --------------------------------------------------------------- |
| `run_id`           | text      | igen     | **elsődleges kulcs**, FK `workflow_run.id`, `ON DELETE CASCADE` |
| `document_version` | integer   | igen     | a dokumentum sémaverziója, kiemelve a JSON-ból                  |
| `document`         | text json | igen     | a teljes pillanatkép, lásd 5. szekció                           |
| `captured_at_ms`   | időbélyeg | igen     |                                                                 |

Index: `run_graph_snapshot_version_idx` a `(document_version)` oszlopon. Ez a lekérdezés mögötte: "mely futások dokumentuma áll még az N-edik verzión", ami az olvasó lánc karbantartásához kell (5.4).

**Miért külön tábla és nem oszlop a `workflow_run` táblán.** A futás lista lekérdezés (`SELECT ... FROM workflow_run`) így egyáltalán nem érinti a pillanatkép dokumentumot, és a pillanatképnek saját, önálló verziószáma és saját, csak beszúrást engedő életciklusa lehet (5.5).

### 4.10 `step_run`

| Oszlop                        | Típus     | Kötelező | Megjegyzés                                                                   |
| ----------------------------- | --------- | -------- | ---------------------------------------------------------------------------- |
| `id`                          | text      | igen     | elsődleges kulcs, UUID                                                       |
| `run_id`                      | text      | igen     | FK `workflow_run.id`, `ON DELETE CASCADE`                                    |
| `node_id`                     | text      | igen     | a **pillanatképbeli** node azonosító, nem FK a `workflow_node` táblára       |
| `node_type`                   | text      | igen     | a pillanatképből kimásolva, hogy a lista ne igényelje a dokumentum olvasását |
| `parent_step_run_id`          | text      | nem      | FK `step_run.id`, `ON DELETE CASCADE`; a végrehajtási fa                     |
| `iteration`                   | integer   | igen     | ciklus iteráció indexe, alapból 0                                            |
| `attempt`                     | integer   | igen     | retry kísérlet sorszáma, alapból 1                                           |
| `status`                      | text      | igen     | `StepRunStatus`, lásd 7.2                                                    |
| `provider_id`                 | text      | igen     | a lépésre feloldott provider, indításkor befagyasztva                        |
| `model_id`                    | text      | nem      | wire modellazonosító; nem agent lépésnél NULL                                |
| `session_mode`                | text      | nem      | `isolated` vagy `continued`; nem agent lépésnél NULL                         |
| `sdk_session_id`              | text      | nem      | a `system` `init` üzenetből                                                  |
| `resumed_from_session_id`     | text      | nem      | `Options.resume` értéke                                                      |
| `forked_session`              | boolean   | igen     | `Options.forkSession`, alapból hamis                                         |
| `structured_output_strategy`  | text      | nem      | `StructuredOutputStrategyId`                                                 |
| `output`                      | text json | nem      | a lépés kimenete, strukturált kimenetnél a validált objektum                 |
| `result_subtype`              | text      | nem      | az SDK `result` üzenet `subtype` mezője                                      |
| `num_turns`                   | integer   | nem      | az SDK `result` üzenetből                                                    |
| `input_tokens`                | integer   | nem      | összesítés a lépés zárásakor                                                 |
| `output_tokens`               | integer   | nem      | ugyanígy                                                                     |
| `cache_read_input_tokens`     | integer   | nem      | ugyanígy                                                                     |
| `cache_creation_input_tokens` | integer   | nem      | ugyanígy                                                                     |
| `sub_workflow_run_id`         | text      | nem      | FK `workflow_run.id`, `ON DELETE SET NULL`; `sub_workflow` node esetén       |
| `error_kind`                  | text      | nem      |                                                                              |
| `error_message`               | text      | nem      |                                                                              |
| `started_at_ms`               | időbélyeg | nem      |                                                                              |
| `finished_at_ms`              | időbélyeg | nem      |                                                                              |
| `created_at_ms`               | időbélyeg | igen     |                                                                              |

Indexek: `step_run_run_created_idx` a `(run_id, created_at_ms)`, `step_run_run_node_idx` a `(run_id, node_id)`, `step_run_parent_idx` a `(parent_step_run_id)`, `step_run_sub_run_idx` a `(sub_workflow_run_id)` oszlopon.

**A `node_id` szándékosan nem idegen kulcs.** A lépés futás a **pillanatkép** node-jára hivatkozik, nem az élő workflow node-jára. Ha idegen kulcs lenne, egy node törlése a szerkesztőben vagy elvinné a régi futás lépéseit, vagy megakadályozná a szerkesztést; mindkettő ellentmond az 1. döntésnek. A hivatkozás feloldását a pillanatkép dokumentum adja, és a repository a lépés lista olvasásakor a pillanatképből tölti fel a megjelenítendő adatot.

**Nincs egyediségi megszorítás a `(run_id, node_id, ...)` négyesen.** Egy node jogosan futhat sokszor: fan-out ágban ágonként, ciklusban iterációnként, retrynél kísérletenként. A végrehajtás alakját a `parent_step_run_id` fa, az `iteration` és az `attempt` írja le, egyediségi kényszer nélkül.

**A retry új sor, nem állapot.** Egy elbukott lépés `failed` marad, és az `error_handler` egy **új** `step_run` sort hoz létre `attempt + 1` értékkel, ugyanazzal a `parent_step_run_id` és `node_id` értékkel. Így a transcript minden kísérletet megmutat, és nincs szükség `retrying` állapotra.

**A token oszlopok származtatott összesítések.** Ugyanaz az adat megvan a `run_event` sorokban is. A duplikálás a 2. döntés "a statisztika is gyors" követelményét szolgálja: a futás lista lépésenkénti token oszlopot mutat esemény bejárás nélkül. Az összesítés **egyszer** íródik, a terminális állapotba lépéssel azonos tranzakcióban, utána nem változik.

### 4.11 `run_event`

Lásd 6. szekció, mert a mezőkészlet forrásonként indoklást igényel.

### 4.12 `human_approval`

| Oszlop            | Típus     | Kötelező | Megjegyzés                                                |
| ----------------- | --------- | -------- | --------------------------------------------------------- |
| `id`              | text      | igen     | elsődleges kulcs, UUID                                    |
| `run_id`          | text      | igen     | FK `workflow_run.id`, `ON DELETE CASCADE`                 |
| `step_run_id`     | text      | igen     | FK `step_run.id`, `ON DELETE CASCADE`, **egyedi**         |
| `title`           | text      | igen     | a `human_approval` node configjából, kitöltve             |
| `body`            | text      | igen     | a megjelenített szöveg, a kérés pillanatában kirenderelve |
| `payload`         | text json | igen     | amit a döntéshez látni kell (az addigi lépés kimenetek)   |
| `decision`        | text      | nem      | `approved` vagy `rejected`; NULL, amíg nincs döntés       |
| `requested_at_ms` | időbélyeg | igen     |                                                           |
| `decided_at_ms`   | időbélyeg | nem      |                                                           |

Indexek: `human_approval_step_uq` **egyedi** index a `(step_run_id)`, `human_approval_pending_idx` a `(decision, requested_at_ms)` oszlopokon. Az utóbbi szolgálja ki a "mi vár döntésre, időrendben" lekérdezést; SQLite az indexben tárolja a NULL értékeket, tehát a `WHERE decision IS NULL ORDER BY requested_at_ms` kiszolgálható belőle.

A `run_id` denormalizált (levezethető a `step_run` soron át), hogy a több futáson átívelő "függő jóváhagyások" lista egy táblából kiszolgálható legyen.

A `body` és a `payload` a **kérés pillanatában** rögzül, nem a megjelenítéskor renderelődik. Így a fél évvel későbbi visszanézés ugyanazt mutatja, amit a döntéshozó látott.

### 4.13 `app_setting`

Egysoros tábla a globális alapértelmezéseknek.

| Oszlop                | Típus     | Kötelező | Megjegyzés                          |
| --------------------- | --------- | -------- | ----------------------------------- |
| `id`                  | integer   | igen     | elsődleges kulcs, `CHECK (id = 1)`  |
| `default_provider_id` | text      | nem      | a globális alapértelmezett provider |
| `updated_at_ms`       | időbélyeg | igen     |                                     |

A `CHECK (id = 1)` az egysorosságot kényszeríti ki adatbázis szinten (F-15).

A `default_provider_id` **nullable, és a migráció nem tölti ki**. Nincs olyan mérésünk vagy user döntésünk, ami megmondaná, melyik provider legyen az alapértelmezett; egy szállított érték találgatás lenne. NULL esetén a futás indítás `no_default_provider` hibával áll meg, és a felület az első indulásnál kéri be a választást.

### 4.14 `provider_concurrency_limit`

| Oszlop                 | Típus     | Kötelező | Megjegyzés                         |
| ---------------------- | --------- | -------- | ---------------------------------- |
| `provider_id`          | text      | igen     | elsődleges kulcs                   |
| `max_concurrent_steps` | integer   | igen     | `CHECK (max_concurrent_steps > 0)` |
| `updated_at_ms`        | időbélyeg | igen     |                                    |

Lásd 11. szekció. A tábla **üresen indul**, a migráció egyetlen sort sem szúr be.

### 4.15 A kaszkád lánc, a 3. döntés

```
workflow torlese
  -> workflow_node        (ON DELETE CASCADE)
  -> workflow_edge        (ON DELETE CASCADE, a node-on at is)
  -> workflow_run         (ON DELETE CASCADE)
       -> run_graph_snapshot   (ON DELETE CASCADE)
       -> step_run             (ON DELETE CASCADE)
            -> step_run        (parent_step_run_id, ON DELETE CASCADE)
            -> run_event       (ON DELETE CASCADE)
            -> human_approval  (ON DELETE CASCADE)
       -> run_event            (ON DELETE CASCADE)
       -> human_approval       (ON DELETE CASCADE)
       -> workflow_run         (root_run_id, ON DELETE CASCADE, al-workflow futasok)
```

**Ez visszavonhatatlan.** Nincs archiválás, nincs soft delete, nincs `deleted_at` oszlop és nincs kuka. Egy workflow törlése a futásait, a pillanatképeit, a lépés futásait, minden eseményét és minden jóváhagyását véglegesen elviszi, az al-workflow futásaival együtt. A művelet után az adat nem állítható vissza az alkalmazásból.

**A felületnek meg kell erősítést kérnie**, és a megerősítésnek meg kell neveznie, mi vész el: a workflow nevét, a futások számát és az események számát. A repository ezt támogatja: a törlés előtt lekérdezhető összesítés, a törlés után pedig a ténylegesen törölt sorok száma áll rendelkezésre (9.2).

A kaszkádot a lánc végigviteléhez **kötelező** a `PRAGMA foreign_keys = ON` (F-1). Enélkül a törlés csendben árva sorokat hagy. Ezért a pragma alkalmazása az adatbázis megnyitás elválaszthatatlan része (10.2), és külön elfogadási kritérium méri (15. szekció, 12. pont).

## 5. A gráf pillanatkép és a séma verziózás

### 5.1 Mit tárolunk

A futás indításakor a teljes gráf és minden lépés beállítása bemásolódik a futás mellé, egyetlen JSON dokumentumként:

```
GraphSnapshotDocument {
  version: number                  // a dokumentum semaverzioja
  capturedAtMs: number
  sdkVersionPin: string            // a telepitett Agent SDK verzio a futas inditasakor
  workflow: { id, name, description }
  nodes: readonly SnapshotNode[]
  edges: readonly SnapshotEdge[]
}

SnapshotNode {
  id, type, label, position: { x, y }
  config: unknown                  // a node config, valtozatlanul kimasolva
  effectiveProviderId: ProviderId  // a haromszintu feloldas eredmenye, befagyasztva
}

SnapshotEdge { id, sourceNodeId, targetNodeId, sourceHandle, targetHandle, branchKey }
```

**Az `effectiveProviderId` a háromszintű feloldás befagyasztott eredménye**: globális alapértelmezés, workflow felülírás, lépés felülírás, ebben a sorrendben. Így egy fél éve lefutott workflow-nál nem kell újra feloldani a providert olyan globális beállításból, ami azóta megváltozott.

**Az `sdkVersionPin` azért van benne**, mert a research 3. szekciója szerint a kimenő kérés mezőlistája SDK verzióhoz kötött. Visszanézéskor ez mondja meg, milyen kliensverzió alatt futott a workflow. Az érték a telepített csomag verziója, nem kitalált szám.

### 5.2 Verziószám, két szinten és külön

| Verzió                   | Mit ver                                                           | Ki kezeli                                        |
| ------------------------ | ----------------------------------------------------------------- | ------------------------------------------------ |
| adatbázis séma verzió    | a táblák és indexek alakja                                        | drizzle-kit, `__drizzle_migrations` tábla (F-18) |
| `GRAPH_DOCUMENT_VERSION` | a pillanatkép dokumentum alakja, a node config uniót is beleértve | a kódban álló egész literál                      |

A kettő független. Egy új oszlop a `run_event` táblán nem érinti a pillanatképet, és egy új mező az `AgentStepConfig` uniójában nem igényel adatbázis migrációt.

**A dokumentum verzió akkor és csak akkor nő**, ha egy meglévő futás dokumentuma a mai olvasóval már nem olvasható helyesen. Új, opcionális mező felvétele nem növeli, mert a régi dokumentum a hiányzó mezőre a hiány szemantikáját hordozza.

**Egy dokumentum szintű szám van, nem node típusonkénti.** Az alternatíva (node típusonként külön `configVersion`) finomabb, de tíz párhuzamos verziólánccal jár, tíz diszpécser ponttal. Egy szám mellett egy diszpécser pont van, és egy verziólépésen belül az átalakító függvény csak az érintett node típusokhoz nyúl. Ez a döntés, az alternatíva megnevezve.

### 5.3 Hogyan olvassuk vissza

```
readGraphSnapshot(stored: unknown): Outcome<GraphSnapshotDocument>
```

A lépések:

1. `isRecord(stored)` a `@easter-workflow-builder/typeguards` csomagból. Ha nem rekord: `Outcome` hibaág, `malformed_graph_document`.
2. A `version` mező kiolvasása és egész számra szűkítése. Hiány vagy nem szám: `malformed_graph_document`.
3. `switch` a verzión, kimerítő ágakkal. A `switch-exhaustiveness-check` ESLint szabály miatt egy új verzió felvétele fordítási hibát ad mindaddig, amíg az ág hiányzik.
4. Verziónként egy saját typeguard (`isGraphSnapshotDocumentV1`, ...) igazolja az adott verzió alakját, majd egy átalakító függvény (`upgradeV1ToV2`, ...) a következő verzióra emeli. Az átalakítás láncban fut az aktuális verzióig.
5. Ismeretlen, a mai kódnál újabb verzió: `Outcome` hibaág, `unknown_graph_document_version`. A felület ilyenkor azt írja ki, hogy a futás egy újabb alkalmazás verzióval készült, és nem jeleníti meg a gráfot. Nem tippel, nem esik szét.

**Az átalakítás kizárólag olvasáskor történik, és soha nem íródik vissza.** A tárolt sor bitre az marad, ami a futás indításakor keletkezett.

### 5.4 Mi garantálja, hogy a régi futás megjeleníthető marad

Négy dolog együtt:

1. **A tárolt sor változatlan.** A `run_graph_snapshot` sor beszúrás után soha nem módosul (5.5).
2. **Minden valaha kiadott verzióhoz megmarad az olvasója.** Egy verzió olvasóját törölni csak akkor szabad, ha a `SELECT COUNT(*) FROM run_graph_snapshot WHERE document_version = N` nulla. A `run_graph_snapshot_version_idx` index pontosan ezt a lekérdezést szolgálja ki.
3. **Regressziós teszt verziónként.** Minden kiadott verzióhoz tartozik egy commitolt fixture dokumentum a spec fájl mellett, és egy `.spec.ts`, ami igazolja, hogy a mai `readGraphSnapshot` megjelenítendő dokumentumot ad belőle. Egy visszafelé nem kompatibilis változtatás ezt a tesztet megbuktatja.
4. **A hibaág explicit.** Ismeretlen verziónál nevesített hibaág van, nem kivétel és nem részlegesen kitöltött objektum.

### 5.5 A pillanatkép megváltoztathatatlansága

Két, egymástól független védelem:

1. **A repository rétegben nincs olyan művelet, ami a `run_graph_snapshot` táblát módosítja.** Egyetlen beszúrási út van, a `startRun` (9.2), és nincs sem `updateSnapshot`, sem általános `update` metódus. Amit nem exportál a barrel, azt kívülről nem lehet hívni (SPEC-002 6.6 5. szabálya).
2. **Adatbázis szintű trigger.** Egy `BEFORE UPDATE` trigger a táblán `RAISE(ABORT, ...)` hívással megbuktatja a módosítást. A trigger nyers SQL, a drizzle-kit `--custom` migrációjában (F-19). A pontos trigger szintaxis ellenőrzése a végrehajtás első feladata a hozzá tartozó lépésben; ha bármi miatt nem használható, az 1. pont önmagában is érvényes védelem, és a tény a `docs/research/` alá kerül.

## 6. Az esemény tábla

### 6.1 Mit tárolunk és miért kettőt

A 2. döntés: minden eseménynél eltároljuk a nyers SDK üzenetet JSON-ként, és mellé a lekérdezéshez szükséges normalizált mezőket. A nyers üzenet adja a pontos újrajátszást, a normalizált mezők a gyors statisztikát és szűrést.

**Egy tábla, nem kettő.** A transcript a motor eseményeit (lépés indult, ág elágazott, jóváhagyás kért) és az SDK üzeneteket **összefésülve** mutatja. Ha két táblában lennének, minden transcript lekérdezés összefésülést igényelne, és nem lenne egyetlen, közös sorszám a WebSocket replayhez. Ezért egy tábla van, `origin` diszkriminátorral.

### 6.2 Mezőkészlet

| Oszlop                        | Típus     | Kötelező | Forrás                                                              |
| ----------------------------- | --------- | -------- | ------------------------------------------------------------------- |
| `id`                          | integer   | igen     | `PRIMARY KEY AUTOINCREMENT` (F-9, F-13), a replay kurzor            |
| `run_id`                      | text      | igen     | FK `workflow_run.id`, `ON DELETE CASCADE`                           |
| `step_run_id`                 | text      | nem      | FK `step_run.id`, `ON DELETE CASCADE`; futás szintű eseménynél NULL |
| `origin`                      | text      | igen     | `sdk` vagy `engine`                                                 |
| `kind`                        | text      | igen     | `RunEventKind`, lásd 6.4                                            |
| `occurred_at_ms`              | időbélyeg | igen     | a beérkezés ideje                                                   |
| `sdk_message_type`            | text      | nem      | az `SDKMessage` `type` mezője szó szerint                           |
| `sdk_message_subtype`         | text      | nem      | a `system` és a `result` üzenet `subtype` mezője                    |
| `sdk_session_id`              | text      | nem      | `session_id`                                                        |
| `sdk_uuid`                    | text      | nem      | `uuid`, az idempotens hozzáfűzés kulcsa                             |
| `parent_tool_use_id`          | text      | nem      | `parent_tool_use_id` (a `stream_event` üzenet mezője)               |
| `tool_name`                   | text      | nem      | az asszisztens üzenet `tool_use` blokkjából                         |
| `tool_use_id`                 | text      | nem      | ugyanonnan                                                          |
| `input_tokens`                | integer   | nem      | `usage`                                                             |
| `output_tokens`               | integer   | nem      | `usage`                                                             |
| `cache_read_input_tokens`     | integer   | nem      | `usage`, research 2. szekció                                        |
| `cache_creation_input_tokens` | integer   | nem      | `usage`, research 2. szekció                                        |
| `num_turns`                   | integer   | nem      | a `result` üzenetből                                                |
| `payload`                     | text json | igen     | a nyers SDK üzenet, vagy motor eseménynél a motor esemény törzse    |

**Minden SDK eredetű normalizált mező nullable.** A kinyerést typeguard végzi a nyers üzeneten. Ha egy mező hiányzik, az oszlop NULL marad. Így egyetlen SDK mező meglétét sem feltételezzük, és egy SDK verzióváltás nem tud kitalált értéket beírni.

**Költség oszlop nincs.** A research 5.5 szekciója szerint a `result.total_cost_usd` first-party árazással számol, és a `minimax` providernél nem használható; MiniMax árazásunk nincs. Az érték benne marad a nyers `payload` JSON-ban, de nem lesz belőle normalizált, összegezhető oszlop, mert az azt sugallná, hogy összeadható. Ha egyszer lesz saját árazási forrásunk, akkor kap oszlopot.

**Az "újrajátszható" érték szintű, nem bájt szintű.** Az SDK objektumot ad át, nem bájtsorozatot, tehát nincs eredeti bájtkép, amit meg lehetne őrizni. A `payload` a szerializált objektum, és a visszaolvasás érték szerint azonos üzenetet ad.

### 6.3 Sorszámozás a WebSocket replayhez

**Egyetlen sorszám van: a `run_event.id`, `INTEGER PRIMARY KEY AUTOINCREMENT`.**

Miért ez:

- Az `AUTOINCREMENT` szigorúan növekvő, soha újra nem használt értéket ad (F-9). A sima `INTEGER PRIMARY KEY` nem, mert a törölt legnagyobb rowid újrahasznosulhat, és egy visszajátszó kliens ilyenkor átugorhatna eseményeket.
- WAL módban egyszerre egy író van (F-8), tehát a párhuzamos ágakból érkező események sorszámai sorosan, ütközés nélkül keletkeznek.
- A replay szerződés egyetlen egész szám: a kliens elküldi a legutóbb látott azonosítót, a szerver a `WHERE run_id = ? AND id > ? ORDER BY id` sorokat küldi vissza.

**Futásonkénti külön sorszám nincs.** Egy `run_seq` oszlop minden beszúrás elé egy `MAX(run_seq)` olvasást tenne, és semmivel nem adna többet: a futáson belüli teljes rendezést a globális `id` már megadja. Ha a felület sorszámot mutat a transcriptben, azt megjelenítéskor számolja.

### 6.4 A `kind` értékkészlete

`origin = 'sdk'`, a research 1. szekció `SDKMessage` uniója szerint, egy az egyben:

`sdk_system`, `sdk_assistant`, `sdk_user`, `sdk_stream_event`, `sdk_result`, `sdk_hook_started`, `sdk_hook_progress`, `sdk_hook_response`, `sdk_informational`, `sdk_commands_changed`, `sdk_rate_limit`, `sdk_context_usage`

`origin = 'engine'`, a jóváhagyott node típusokhoz kötve:

`run_started`, `run_finished`, `run_interrupted`, `step_started`, `step_finished`, `branch_taken`, `fan_out_expanded`, `join_resolved`, `loop_iteration_started`, `approval_requested`, `approval_decided`, `sub_workflow_started`, `sub_workflow_finished`

Összesen 25 érték. A `kind` nem `CHECK` constraint, mert egy új SDK üzenettípus akkor migrációt igényelne; a szűkítést a `RunEventKind` unió és a typeguard adja a repository határon.

### 6.5 Indexek

| Index                       | Oszlopok                     | Melyik lekérdezést szolgálja                                        |
| --------------------------- | ---------------------------- | ------------------------------------------------------------------- |
| `run_event_run_id_idx`      | `(run_id, id)`               | transcript és WebSocket replay: `run_id = ? AND id > ? ORDER BY id` |
| `run_event_step_run_id_idx` | `(step_run_id, id)`          | egy lépés transcriptje a gráfon rákattintva                         |
| `run_event_run_uuid_uq`     | `(run_id, sdk_uuid)`, egyedi | idempotens hozzáfűzés újracsatlakozás vagy újrapróbálkozás után     |

A `run_event_run_uuid_uq` NULL `sdk_uuid` mellett nem korlátoz, mert UNIQUE indexben minden NULL különbözőnek számít (F-10). A motor eseményeknek nincs `sdk_uuid` értékük, tehát rájuk az index nem hat, és nincs szükség részleges indexre.

Token összesítéshez (`SUM(output_tokens) WHERE run_id = ?`) és eszközhasználati statisztikához (`WHERE run_id = ? AND tool_name IS NOT NULL GROUP BY tool_name`) a `run_event_run_id_idx` elegendő, mert mindkettő `run_id` szerint szűkít. Külön index nem indokolt mérés nélkül.

## 7. Állapotgépek

### 7.1 Futás

Állapotok: `pending`, `running`, `succeeded`, `failed`, `cancelled`, `interrupted`.

| Honnan    | Hova          | Kiváltó                                                       |
| --------- | ------------- | ------------------------------------------------------------- |
| `pending` | `running`     | a motor elindította az első lépést                            |
| `pending` | `cancelled`   | a felhasználó megszakította indulás előtt                     |
| `pending` | `interrupted` | indulási helyreállítás (7.4)                                  |
| `running` | `succeeded`   | minden ág terminális, hiba nélkül                             |
| `running` | `failed`      | kezeletlen hiba, vagy elutasított jóváhagyás kezelő ág nélkül |
| `running` | `cancelled`   | a felhasználó megszakította                                   |
| `running` | `interrupted` | indulási helyreállítás (7.4)                                  |

Terminális: `succeeded`, `failed`, `cancelled`, `interrupted`. Terminális állapotból nincs kimenő átmenet.

**A `waiting_approval` nem futás állapot.** Egy futásnak lehet egyszerre egy váró és három futó ága, tehát a várakozás lépés szintű tulajdonság (7.2). A felület a "jóváhagyásra vár" jelzést a lépés futásokból származtatja.

### 7.2 Lépés futás

Állapotok: `pending`, `running`, `waiting_approval`, `succeeded`, `failed`, `rejected`, `cancelled`, `interrupted`.

| Honnan             | Hova               | Kiváltó                                                                |
| ------------------ | ------------------ | ---------------------------------------------------------------------- |
| `pending`          | `running`          | a motor elindította a lépést                                           |
| `pending`          | `cancelled`        | a futás megszakadt, mielőtt a lépés elindult                           |
| `pending`          | `interrupted`      | indulási helyreállítás                                                 |
| `running`          | `waiting_approval` | kizárólag `human_approval` node esetén, a jóváhagyási kérés beírásakor |
| `running`          | `succeeded`        | a lépés befejeződött, strukturált kimenetnél validált kimenettel       |
| `running`          | `failed`           | hiba, vagy `result` üzenet nem `success` subtype-pal                   |
| `running`          | `cancelled`        | megszakítás                                                            |
| `running`          | `interrupted`      | indulási helyreállítás                                                 |
| `waiting_approval` | `succeeded`        | a felhasználó jóváhagyta                                               |
| `waiting_approval` | `rejected`         | a felhasználó elutasította                                             |
| `waiting_approval` | `cancelled`        | megszakítás várakozás közben                                           |
| `waiting_approval` | `interrupted`      | indulási helyreállítás                                                 |

Terminális: `succeeded`, `failed`, `rejected`, `cancelled`, `interrupted`.

**A `rejected` külön állapot, nem `failed`.** Az elutasítás emberi döntés, nem hiba. A gráf az elutasítást külön kimeneti ágra vezetheti (`workflow_edge.branch_key`); ha nincs ilyen él, a futás `failed` állapotba megy.

**A `result` HTTP sikere önmagában nem elég a `succeeded` állapothoz.** A research 5.2 szekciója (M-34 következménye) kimondja: "a lépés futtatónak kötelező a `result` üzenet `subtype` mezőjét és a `structured_output` mező meglétét ellenőriznie, mert a HTTP siker önmagában nem jelent kitöltött kimenetet". Strukturált kimenetet váró lépés csak akkor lép `succeeded` állapotba, ha a `subtype` `success`, és a kimenet ténylegesen megvan és sémára illeszkedik. Különben `failed`, `missing_structured_output` hibaosztállyal.

### 7.3 Az átmenetek kikényszerítése

Két, egymást erősítő mechanizmus:

1. **Átmeneti tábla a kódban.** `canTransitionRunStatus(from, to): boolean` és `canTransitionStepRunStatus(from, to): boolean`, kimerítő `switch` szerkezettel, saját `.spec.ts` fájllal minden ágra.
2. **Compare and set az adatbázisban.** Minden állapotváltó `UPDATE` tartalmazza a **várt jelenlegi állapotot** a `WHERE` feltételben. Ha nulla sor változott, a művelet `Outcome` hibaágat ad `illegal_status_transition` osztállyal, nem csendben nem csinál semmit. Így két párhuzamos ág nem tudja ugyanazt a lépést kétszer lezárni.

A repository nem ad általános `updateStatus(id, status)` metódust. Nevesített metódusok vannak (`markStepRunning`, `markStepSucceeded`, ...), tehát a hívó nem tud érvénytelen állapotot beírni (9.3).

### 7.4 Újraindítás, megszakítás, szerver leállás

**Feltevés, kimondva.** Egy adatbázis fájlt pontosan egy szerver folyamat birtokol. A rendszer egy felhasználós, nincs fürtözés. Ez nem mérés kérdése, hanem a termék rögzített hatóköre, és a helyreállítás erre épül.

**Megszakítás.** A felhasználó megszakítja a futást. Egy tranzakcióban: a futás `cancelled` állapotba megy, minden nem terminális lépés futása `cancelled` állapotba megy, és egy `run_finished` motor esemény íródik. Az SDK oldali megszakítást (`Query.interrupt`) a motor végzi, a DB csak a következményt rögzíti.

**Szerver leállás.** A szerver indulásakor, **mielőtt bármilyen hálózati kapcsolatot fogadna**, lefut a helyreállítás: minden `pending` vagy `running` futás `interrupted` állapotba kerül, minden hozzájuk tartozó nem terminális lépés futás szintén, és futásonként egy `run_interrupted` motor esemény íródik. Az egész egy tranzakcióban fut. Az egy folyamatos birtoklás feltevése miatt egy `running` futás indulás után definíció szerint árva.

**Az `interrupted` terminális.** Egy megszakadt futás nem folytatható. Indok: a folytatás azt igényelné, hogy az SDK session-öket újra fel lehessen venni ott, ahol abbamaradtak, erre pedig nincs mérésünk, és a research 1. szekció `resume` mechanizmusa lépés határra, nem lépés közepére való. Találgatni nem fogunk.

**Újraindítás új futás.** Az újraindítás **új** `workflow_run` sort hoz létre, **új** pillanatképpel a workflow aktuális állapotáról (ez az 1. döntésből következik), és a `restarted_from_run_id` mezőben rögzíti a származást. A felület felajánlhatja az eredeti futás bemenetének átvételét; a `workflow_run.input` másolása erre elég.

## 8. A `packages/db` csomag belső szerkezete

A csomag **egy tárgykörű**, tehát a SPEC-002 6.1 pont 8. szabálya szerint a téma mappák közvetlenül a `src/` alatt állnak, egy szint mélyen. Kétszintű tagolás tilos: a SPEC-002 kimondja, hogy pontosan két kétszintű csomag van a repóban, a `core` és a `provider-capability`.

```
packages/db/
  package.json
  tsconfig.json
  drizzle.config.ts
  CLAUDE.md                    a csomag gyokereben, es SEHOL MASHOL
  drizzle/                     generalt SQL migraciok, gitbe commitolva
  src/
    index.ts                   barrel, csak nevesitett ujraexport
    database-file/
    sqlite-connection/
    migration/
    workflow-graph/
    graph-snapshot/
    workflow-run/
    step-run/
    run-event/
    human-approval/
    app-setting/
    provider-concurrency/
    run-recovery/
```

Tizenkét téma mappa. Témánként:

| Téma                   | Mi kerül bele                                                                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `database-file`        | az adatbázis fájl helyének feloldása: env változó **neve**, alapértelmezett útvonal, a könyvtár létrehozása                      |
| `sqlite-connection`    | a `better-sqlite3` példány nyitása, a pragmák alkalmazása, a `drizzle()` bekötése, a zárás                                       |
| `migration`            | a migrációs mappa útvonala és a `migrate()` hívás burkolása `Outcome` hibaágra                                                   |
| `workflow-graph`       | `workflow`, `workflow_node`, `workflow_edge` tábla, a `NodeType` unió, a node config unió és typeguardjai, a workflow repository |
| `graph-snapshot`       | `run_graph_snapshot` tábla, a dokumentum típusa, a `GRAPH_DOCUMENT_VERSION` konstans, a verziódiszpécser olvasó és a typeguardok |
| `workflow-run`         | `workflow_run` tábla, `RunStatus`, az átmeneti szabály, a futás repository                                                       |
| `step-run`             | `step_run` tábla, `StepRunStatus`, az átmeneti szabály, a lépés futás repository                                                 |
| `run-event`            | `run_event` tábla, `RunEventKind`, az SDK üzenet normalizálása, az esemény repository                                            |
| `human-approval`       | `human_approval` tábla, `ApprovalDecision`, a jóváhagyás repository                                                              |
| `app-setting`          | `app_setting` tábla és a hozzá tartozó repository                                                                                |
| `provider-concurrency` | `provider_concurrency_limit` tábla és a hozzá tartozó repository                                                                 |
| `run-recovery`         | az indulási helyreállítás (7.4), ami a `workflow_run` és a `step_run` táblát együtt érinti, ezért egyik témába sem tartozik      |

**Miért nem `schema/` és `repositories/` mappa.** Az technikai réteg szerinti tagolás lenne, amit a SPEC-002 6.5 pontja tilt. A tábla, a hozzá tartozó unió, a typeguardjai és a repositoryja ugyanarról a domain fogalomról szól, tehát egy témába tartozik.

**`CLAUDE.md` kizárólag a csomag gyökerében.** Sem a téma mappák, sem a `drizzle/` mappa nem kap saját fájlt (SPEC-002 6.7). A gyökér `CLAUDE.md` `## Fájlok` táblázata a **téma mappákat** sorolja fel, nem az egyes fájlokat.

**Fájlnév konvenció.** Egy fájl egy exportált egység, a téma mappán belül. A tábla definíciója a tábla nevét viseli kebab-case alakban (`workflow-node.ts`), a repository a `-repository.ts` végződést (`workflow-repository.ts`), a typeguard az `is-` előtagot (`is-node-config.ts`). A teszt fájlok `.spec.ts` végződésűek, a megvalósítás mellett, azonos mappában.

**Függőségi irány.** A `db` L2 réteg. A jelen spec után a `dependencies` mezője: `@easter-workflow-builder/core` (az `Outcome` és az `isOkOutcome` miatt), `@easter-workflow-builder/logger`, `@easter-workflow-builder/typeguards` és **újként** `@easter-workflow-builder/provider-capability` (L1), a `ProviderId`, az `AgentToolId`, a `ThinkingMode` és a `StructuredOutputStrategyId` típus miatt. Minden él szigorúan csökkenő rétegszám felé mutat, tehát a `bun run check:graph` zöld marad.

**Új típus a `provider-capability` csomagban.** A `ProviderId` unió ma nem létezik: a provider azonosítók a `provider-registry` (L3) `ProviderRegistry` interfészének kulcsaiként állnak, ahonnan a `db` (L2) nem importálhat. Ezért a `provider-capability` csomag új téma mappát kap, `provider-id/provider-id.ts` néven, egyetlen típussal. Ez pontosan az `agent-tool-id` téma bevált mintája (SPEC-002 5.4, a duplikált mappaszint tilalmával együtt), és a `provider-registry` `ProviderRegistry` interfésze ugyanezt a uniót használja kulcsként, tehát nem keletkezik második igazságforrás.

**Nyitott, szándékosan halasztott lépés.** Amikor a `@easter-workflow-builder/protocol` csomag valódi tartalmat kap, a megosztott domain típusok (node típus unió, node config unió, állapotok, esemény típusok) oda kerülnek, és a `db` onnan importálja őket, mert az `@easter-workflow-builder/ui` (L2) nem függhet a `db` csomagtól (azonos réteg), az `@easter-workflow-builder/web` pedig a SPEC-002 4. szekciója szerint kifejezetten nem függhet tőle. A lépés előfeltétele, hogy a `provider-capability` L1-ről L0-ra kerüljön a réteg térképen, ami megengedett, mert nincs kifelé mutató éle. **Ezt a lépést a SPEC-003 nem hajtja végre**, mert sem az `ui`, sem a `web` csomag nincs a hatókörében, és a mozgatás a `db` barreljén belüli átírás lesz.

## 9. Repository réteg

### 9.1 Alak

`openDatabase()` egyetlen belépési pont, ami egy `DatabaseContext` objektumot ad vissza. A `drizzle()` példány és a `better-sqlite3` handle a lezárásban (closure) marad, és soha nem lesz sem mező, sem exportált érték.

```
openDatabase(filePath: string): Outcome<DatabaseContext>

DatabaseContext {
  workflows: WorkflowRepository
  runs: WorkflowRunRepository
  stepRuns: StepRunRepository
  events: RunEventRepository
  approvals: HumanApprovalRepository
  settings: AppSettingRepository
  concurrencyLimits: ProviderConcurrencyRepository
  recovery: RunRecovery
  transaction<TValue>(work: () => Outcome<TValue>): Outcome<TValue>
  close(): void
}
```

Osztály ebben a csomagban nincs, tehát privát mező kérdés sem merül fel; a zártságot a lezárás adja. Ha egy későbbi bővítés mégis osztályt igényel, a `#` privát mező kötelező, a `private` kulcsszó pedig lint hibát ad (SPEC-001 7. szekció).

Minden művelet `Outcome<T>` értéket ad vissza a `@easter-workflow-builder/core` csomagból. Kivétel nem repül ki a rétegből: a `better-sqlite3` dobott hibáját a repository elkapja és hibaosztályra képezi.

### 9.2 Műveletek

| Repository                      | Művelet                                                                                                                      | Megjegyzés                                                                                                 |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `WorkflowRepository`            | `createWorkflow`, `updateWorkflow`, `getWorkflow`, `listWorkflows`                                                           |                                                                                                            |
|                                 | `replaceGraph(workflowId, nodes, edges)`                                                                                     | a **teljes** gráfot cseréli egy tranzakcióban; nincs node és él szintű CRUD                                |
|                                 | `readGraph(workflowId)`                                                                                                      | node és él lista, typeguarddal szűkített configgal                                                         |
|                                 | `summarizeDeletion(workflowId)`                                                                                              | mi veszne el: futás és esemény darabszám, a megerősítő párbeszédhez                                        |
|                                 | `deleteWorkflow({ workflowId, acknowledgeIrreversible: true })`                                                              | az egyetlen törlési út; a literál `true` mező nélkül nem fordul le                                         |
| `WorkflowRunRepository`         | `startRun(input)`                                                                                                            | **az egyetlen** beszúrási út; egy tranzakcióban írja a futást, a pillanatképet és a `run_started` eseményt |
|                                 | `getRun`, `listRuns`, `listRunsForWorkflow`                                                                                  |                                                                                                            |
|                                 | `markRunRunning`, `markRunSucceeded`, `markRunFailed`, `markRunCancelled`                                                    | compare and set (7.3)                                                                                      |
|                                 | `readSnapshot(runId)`                                                                                                        | `readGraphSnapshot` diszpécserrel, `Outcome` hibaággal ismeretlen verzióra                                 |
| `StepRunRepository`             | `createStepRun`, `listStepRuns(runId)`, `getStepRun`                                                                         |                                                                                                            |
|                                 | `markStepRunning`, `markStepWaitingApproval`, `markStepSucceeded`, `markStepFailed`, `markStepRejected`, `markStepCancelled` | compare and set                                                                                            |
|                                 | `attachSession(stepRunId, { sessionId, resumedFrom, forked })`                                                               | a `system` `init` üzenet feldolgozásakor                                                                   |
| `RunEventRepository`            | `appendSdkEvent(input)`, `appendEngineEvent(input)`                                                                          | a normalizálást a repository végzi, a hívó nyers üzenetet ad át                                            |
|                                 | `readEventsSince(runId, afterEventId, limit)`                                                                                | a `limit` **kötelező paraméter**, nincs szállított alapérték (13. szekció)                                 |
|                                 | `readEventsForStep(stepRunId, limit)`                                                                                        |                                                                                                            |
|                                 | `aggregateRunTokens(runId)`                                                                                                  | négy token oszlop összegzése                                                                               |
| `HumanApprovalRepository`       | `requestApproval`, `decideApproval`, `getApprovalForStep`, `listPendingApprovals`                                            | a `decideApproval` és a lépés állapotváltás egy tranzakcióban fut                                          |
| `AppSettingRepository`          | `readSettings`, `setDefaultProvider`                                                                                         |                                                                                                            |
| `ProviderConcurrencyRepository` | `readLimit(providerId)`, `readAllLimits`, `setLimit`, `clearLimit`                                                           |                                                                                                            |
| `RunRecovery`                   | `recoverInterruptedRuns()`                                                                                                   | indulási helyreállítás (7.4), egy tranzakcióban                                                            |

### 9.3 Hogyan nem kerülhetők meg a séma garanciák

| Garancia                         | Mi kényszeríti ki                                                                                                                                                                                                                       |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| nincs nyers SQL kívülről         | a barrel nem exportál sem Drizzle tábla objektumot, sem `drizzle()` példányt, sem `better-sqlite3` típust; a `package.json` `exports` mezője kizárólag a `./src/index.ts` fájlra mutat, tehát mély import sem lehetséges (SPEC-002 6.6) |
| nincs futás pillanatkép nélkül   | a `startRun` az egyetlen beszúrási út a `workflow_run` táblára, és a pillanatképet ugyanabban a tranzakcióban írja; a `run_graph_snapshot.run_id` NOT NULL elsődleges kulcs                                                             |
| nincs érvénytelen állapotátmenet | nevesített átmenet metódusok, átmeneti szabály függvény, plusz compare and set (7.3)                                                                                                                                                    |
| nincs árva sor törlés után       | `ON DELETE CASCADE` a teljes láncon, plusz a kapcsolatonként bekapcsolt `foreign_keys` pragma (F-1, F-2, 10.2)                                                                                                                          |
| nincs feltételezett JSON alak    | minden JSON oszlop `unknown` a séma szintjén, a szűkítés typeguarddal a repository határon; `any` és `as` tiltott (SPEC-001 7. szekció)                                                                                                 |
| nincs véletlen törlés            | a `deleteWorkflow` bemenete kötelezően tartalmazza az `acknowledgeIrreversible: true` literált                                                                                                                                          |
| nincs titok az adatbázisban      | az MCP szerver config `envNames` és `authEnvName` mezőt tárol, sosem értéket (4.4); a repository bemenet típusa nem tartalmaz értékmezőt                                                                                                |

### 9.4 Typeguardok

Az általános guardok (`isRecord`, `isNonEmptyString`, `isFunction`, ...) a meglévő `@easter-workflow-builder/typeguards` csomagból jönnek, és **kötelező** őket használni, nem újraírni. A domain specifikus guardok a saját téma mappájukban élnek, saját `.spec.ts` fájllal:

`isNodeType`, `isNodeConfig` (a tíz ágra kimerítően), `isAgentStepConfig`, `isRunStatus`, `isStepRunStatus`, `isRunEventKind`, `isApprovalDecision`, `isProviderId`, `isGraphSnapshotDocumentV1`.

Minden guard `value is T` alakú, és `unknown` bemenetet fogad. `as` sehol nem szerepel; ahol típuskapcsolás kellene, `satisfies` áll.

## 10. Adatbázis fájl, kapcsolat, migrációk

### 10.1 Az adatbázis fájl helye

| Környezet  | Hol                                                                                                                    |
| ---------- | ---------------------------------------------------------------------------------------------------------------------- |
| fejlesztés | `<repo gyökér>/.data/easter-workflow-builder.sqlite`, ha az env változó nincs beállítva; a `.data/` a `.gitignore`-ban |
| éles       | az `EASTER_DB_FILE` env változóban megadott abszolút útvonal, a könyvtárat az alkalmazás létrehozza, ha hiányzik       |
| teszt      | `:memory:`, spec fájlonként friss példány (12. szekció)                                                                |

Az `EASTER_DB_FILE` nevet fel kell venni a `turbo.json` `globalPassThroughEnv` listájába, különben a task környezetéből kiesik. A változó **útvonalat** tartalmaz, nem titkot. WAL mód mellett az SQLite `-wal` és `-shm` kísérőfájlt hoz létre a fájl mellett (F-6), ezért a `.gitignore` mintának ezekre is illeszkednie kell.

### 10.2 A kapcsolat felállítása, sorrendben

1. `new Database(filePath)` (F-4). A `timeout` opció a dokumentált 5000 ms alapértéken marad (F-5); saját értéket **nem** állítunk, mert nincs mérésünk, ami indokolná.
2. `PRAGMA foreign_keys = ON`. **Minden kapcsolaton, minden tranzakció előtt**, mert kapcsolatonként kell bekapcsolni (F-1), és tranzakción belül csendben hatástalan (F-2).
3. `PRAGMA journal_mode = WAL`, ha a fájl nem `:memory:`. Indok: a WebSocket olvasók a motor írása közben is olvasnak, és WAL mellett az olvasó nem blokkolja az írót. `:memory:` adatbázison a beállítás figyelmen kívül marad (F-7), ezért a kód ott meg sem próbálja, és a spec mindkét ágat lefedi.
4. Migrációk futtatása (10.3).
5. A `drizzle()` példány létrehozása. Séma objektumot **nem** adunk át neki, mert a relációs lekérdező API-t (`db.query.*`) nem használjuk; minden lekérdezés explicit `select` és `join`.

A `close()` a `better-sqlite3` handle zárása. A `DatabaseContext` zárás után minden művelete `database_closed` hibaágat ad.

### 10.3 Migrációk

- **Generálás:** `drizzle-kit generate`, a `packages/db/drizzle.config.ts` alapján (`dialect: 'sqlite'`, `out: './drizzle'`). A generált SQL fájlok és a hozzájuk tartozó snapshot **gitbe kerülnek**.
- **Alkalmazás:** a `drizzle-orm/better-sqlite3/migrator` `migrate()` függvénye, szinkron (F-18), az `openDatabase` részeként, még a hálózati kapcsolatok fogadása előtt. A napló a `__drizzle_migrations` táblába kerül, a Drizzle alapértelmezésén.
- **`drizzle-kit push` tiltott.** A `push` migrációs fájl nélkül szinkronizálja a sémát (F-19), tehát nem marad nyoma annak, hogyan jutott az adatbázis a jelenlegi alakjához, és a teszt adatbázis nem ugyanazon az úton épül fel, mint az éles. Ez projekt döntés; hivatalos, szó szerinti éles ajánlást a drizzle-kit dokumentáció ezen az oldalán nem találtunk, ezért nem hivatkozunk ilyenre.
- **Kézzel írt SQL** (a pillanatkép trigger, 5.5) a `drizzle-kit generate --custom` üres migrációjába kerül (F-19).
- **Fejlesztés és éles ugyanazon az úton.** Nincs külön fejlesztői séma szinkronizálás. Aki sémát módosít, generál egy migrációt, és azt commitolja.
- **Drift ellenőrzés.** A `drizzle-kit generate` futtatása után a `packages/db/drizzle` mappában nem keletkezhet nyomon követetlen fájl. Ez egy token takarékos wrapper script a `tooling/scripts` alatt, és a CI-ban is fut; a viselkedés (mit tesz a drizzle-kit, ha nincs séma változás) a végrehajtás első lépésében ellenőrizendő, mert a hivatalos dokumentáció ezt szó szerint nem mondja ki.

### 10.4 Verziók

| Csomag                  | Verzió        | Hol rögzül                                                                                               |
| ----------------------- | ------------- | -------------------------------------------------------------------------------------------------------- |
| `drizzle-orm`           | 0.45.2        | már a research fájlban áll                                                                               |
| `better-sqlite3`        | 13.0.3        | már a research fájlban áll                                                                               |
| `drizzle-kit`           | ellenőrizendő | a végrehajtás első lépése méri és a research fájlba vezeti; a mérés pillanatában az npm `latest` 0.31.10 |
| `@types/better-sqlite3` | ellenőrizendő | ugyanígy; a `better-sqlite3` nem szállít saját típust (F-20)                                             |

Mind a négy **literál verzió** a `packages/db/package.json` fájlban, nem katalógusban: a Bun katalógus a több csomagban használt közös eszközöké (SPEC-001 3. elfogadási kritérium), ezeket pedig egyetlen csomag használja.

## 11. Párhuzamossági korlát, a 4. döntés

**Egy közös szabályozó, providerenként korlátozza az egyidejű agent lépéseket**, függetlenül attól, hány futás és hány ág van. A szabályozó a motorban él, a DB a **konfigurált értéket** tárolja, a `provider_concurrency_limit` táblában (4.14). Futásidejű foglalást a DB nem tárol, mert egy folyamat birtokolja az adatbázist (7.4), és egy in-process szabályozó nem igényel adatbázis állapotot.

**Alapértéket nem szállítunk.** A research 5.6 szekciója kimondja: "Konkrét ágszámot nem javaslunk. A MiniMax dokumentált 200 RPM korlátja ebbe a számításba tartozik, de nincs dokumentált szabály arra, hány párhuzamos ág fér bele, és 429-es választ két mérési körben egyszer sem kaptunk (M-18, M-36), tehát mérési alapunk sincs rá."

**Amit tudunk, mérésből.** Az M-31 a kliens **belső subagent** párhuzamosságát mérte, nem a motorét: `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS=3` mellett a korlát tartott, és a legnagyobb egyidejű kimenő kérésszám 4 volt. A leíró ezt hordozza (`concurrency.measuredSubagentCap: 3`, `concurrency.observedMaxConcurrentRequests: 4`). Ez a lépésen **belüli** kérésszám szorzója, nem a lépések közötti korlát.

**Viselkedés, amíg nincs beállított érték.** Ha egy providerhez nincs sor a táblában, a motor **nem alkalmaz saját korlátot**, és a felület ezt kiírja: "nincs beállított párhuzamossági korlát". Nem választunk csendben egy számot, és nem is blokkolunk, mert mindkettő kitalált érték lenne. A felhasználó a beállításokban adhat meg értéket, ami azonnal érvénybe lép.

**Milyen mérés zárná le.** Egy sorozat, amiben ugyanaz a workflow N párhuzamos agent ággal fut a MiniMax provider ellen, N növelésével, a wire proxyn keresztül rögzítve. A mérendő mennyiségek: az első 429-es válasz N értéke, a `Retry-After` header megléte és értéke, a percenkénti kimenő kérésszám a dokumentált 200 RPM korláthoz képest, valamint a lépésenkénti latencia N függvényében. A mérés lezárná a `rateLimits.retryAfterHeader` és a `rateLimits.rateLimitHeaders` leíró mezőt is, ami ma `unknown` állapotú, épp azért, mert két mérési körben nulla 429 keletkezett. A mérés a SPEC-000 mérési keretében fut, `tools/wire-probe` esettel; addig a tábla üres marad, és a leíró `unknown` értéke áll.

## 12. Tesztelés

### 12.1 Valós SQLite, nem mock

Minden `.spec.ts` valódi `better-sqlite3` adatbázis ellen fut. Nincs mockolt adatbázis és nincs memóriabeli hamis implementáció. Indok: a spec állításainak jelentős része SQLite viselkedés (kaszkád, egyediség NULL-lal, `AUTOINCREMENT`), amit mock nem tud igazolni.

### 12.2 A teszt adatbázis életciklusa

1. `beforeEach`: `openDatabase(':memory:')`. Ez lefuttatja a **commitolt migrációs fájlokat**, tehát a teszt a valódi migrációs SQL-t is méri, nem csak a TypeScript séma leírást. Egy hibás migráció a teszt csomagot bukja meg.
2. A teszt saját adatot ír a repository műveleteken keresztül. Nincs SQL fixture és nincs előre elkészített adatbázis fájl.
3. `afterEach`: `close()`. A memóriabeli adatbázis a kapcsolattal együtt megszűnik, tehát a tesztek közötti szivárgás szerkezetileg lehetetlen.

**Egy kivétel, ami valódi fájlt igényel.** A WAL bekapcsolás ága csak fájl alapú adatbázison figyelhető meg (F-7). Egyetlen spec `node:fs.mkdtempSync` ideiglenes könyvtárba nyit adatbázist, ellenőrzi, hogy a `journal_mode` `wal` lett, majd `afterEach` blokkban törli a könyvtárat a `-wal` és `-shm` kísérőfájlokkal együtt. Ugyanez a spec fedi a memóriabeli ágat is, ahol a mód `memory` marad.

### 12.3 Amit tesztelni kell

| Terület               | Mit igazol a teszt                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| kaszkád               | workflow törlése után a futás, a pillanatkép, a lépés futás, az esemény és a jóváhagyás sorok száma nulla                                   |
| kaszkád, al-workflow  | a gyökér futás törlése az al-workflow futásait is elviszi, akkor is, ha másik workflow-hoz tartoznak                                        |
| idegen kulcs pragma   | pragma nélkül nyitott kapcsolaton a kaszkád nem fut le, a rendes úton nyitott kapcsolaton igen                                              |
| állapotgép            | minden érvényes átmenet sikerül, minden érvénytelen `illegal_status_transition` hibaágat ad; a compare and set nulla sorra hibázik          |
| esemény sorszám       | a sorszám szigorúan növekvő, és a legnagyobb esemény törlése után a következő beszúrás **nem** használja újra az azonosítót (F-9)           |
| idempotens hozzáfűzés | ugyanaz az `sdk_uuid` kétszer beszúrva a második esetben egyediségi hibát ad; NULL `sdk_uuid` mellett tetszőleges sok sor beszúrható (F-10) |
| pillanatkép           | a futás pillanatképe akkor is a régi gráfot adja vissza, ha a workflow-t a futás után átírtuk vagy a node-jait töröltük                     |
| verzió diszpécser     | minden kiadott dokumentumverzió fixture-e megjeleníthető dokumentumot ad; ismeretlen verzió nevesített hibaágat ad                          |
| pillanatkép zártsága  | a `run_graph_snapshot` sor módosítási kísérlete hibázik                                                                                     |
| helyreállítás         | `running` futás és lépés futás sorok után indulási helyreállítás mindkettőt `interrupted` állapotba viszi, és eseményt ír                   |
| titok tilalom         | az MCP szerver config bemeneti típusa nem fogad env **értéket**, csak nevet; a tárolt JSON-ban nem szerepel érték mező                      |
| törlés megerősítése   | a `summarizeDeletion` a ténylegesen törlendő darabszámokat adja, és a törlés utáni sorszám nulla                                            |

### 12.4 Lefedettség

A 100 százalékos küszöb kizárás nélkül érvényes erre a csomagra: a `vitest.config.ts` `coverage.exclude` listája **egyetlen** sorral sem bővülhet. Ez ágszinten azt jelenti, hogy minden `Outcome` hibaághoz tartozik olyan teszt, ami előidézi. A hibaosztályok, amiket elő kell idézni: `not_found`, `illegal_status_transition`, `malformed_graph_document`, `unknown_graph_document_version`, `foreign_key_violation`, `duplicate_event`, `database_closed`, `no_default_provider`, `unimplemented_node_type`, `insufficient_max_turns`, `workflow_recursion_detected`.

A `drizzle.config.ts` a `src/` fán kívül áll, tehát a `coverage.include` mintája (`packages/*/src/**/*.{ts,tsx}`) nem fogja meg. A `tsconfig.json` viszont bevonja a típusellenőrzésbe, hogy ne maradjon ellenőrizetlen fájl a csomagban.

## 13. Nyitott kérdések, amikre nincs forrás

Egyik sem zárható le tippeléssel. Mindegyiknél áll, mi a viselkedés addig, és mi zárná le.

| #   | Kérdés                                                                           | Addig                                                                      | Mi zárná le                                                                                  |
| --- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| O-1 | Providerenkénti párhuzamossági korlát értéke                                     | nincs szállított alapérték, nincs sor a táblában, a motor nem korlátoz     | a 11. szekcióban leírt N növelő mérés a wire proxyn keresztül                                |
| O-2 | A WebSocket replay lapmérete (`readEventsSince` `limit`)                         | kötelező hívási paraméter, nincs alapérték                                 | egy valós futás eseményméret eloszlásának mérése és a WebSocket üzenetméret hatásának mérése |
| O-3 | `busy_timeout` saját érték                                                       | a `better-sqlite3` dokumentált 5000 ms alapértéke marad (F-5)              | `SQLITE_BUSY` előfordulás mérése párhuzamos ágak mellett valós munkaterhelésen               |
| O-4 | Adatmegőrzés, esemény tábla növekedés, `VACUUM` szabály                          | nincs megőrzési szabály, adat csak workflow törléssel vész el              | egy hosszan futó telepítés esemény darabszám és fájlméret mérése                             |
| O-5 | A `drizzle-kit generate` pontos viselkedése séma változás nélkül                 | a drift ellenőrző script első feladata ezt megállapítani                   | futtatott próba, az eredmény a `docs/research/` alá vezetve                                  |
| O-6 | A pillanatkép trigger SQL pontos alakja                                          | a repository szintű zártság önmagában is érvényes védelem (5.5)            | futtatott próba a SQLite dokumentált trigger szintaxisával                                   |
| O-7 | `better-sqlite3` 13.0.3 viselkedése Node 26 alatt (prebuild vagy forrásfordítás) | a végrehajtás első lépése méri helyben és CI-ban                           | futtatott telepítés és importálás mindkét környezetben                                       |
| O-8 | A `drizzle.config.ts` `schema` glob felszedi-e az összes téma mappa tábláját     | a végrehajtás első lépése méri; tartalék a téma útvonalak explicit listája | futtatott `drizzle-kit generate` és a keletkezett SQL összevetése a várt táblákkal           |

## 14. Kockázatok

| Kockázat                                                                   | Hatás                                                       | Védelem                                                                                                                                      |
| -------------------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Elfelejtett `PRAGMA foreign_keys = ON` egy új kapcsolaton                  | csendben árva sorok maradnak törlés után, a 3. döntés sérül | a pragma az `openDatabase` elválaszthatatlan része, és van rá saját spec, ami pragma nélküli kapcsolaton igazolja a kaszkád elmaradását      |
| A pragma tranzakción belülre kerül                                         | csendben no-op (F-2)                                        | a pragma a nyitás első lépése, a migrációk és minden tranzakció **előtt**                                                                    |
| Séma módosítás migráció generálás nélkül                                   | a fejlesztői és az éles adatbázis eltér                     | drift ellenőrző wrapper a `tooling/scripts` alatt, CI-ban is futtatva (10.3)                                                                 |
| `better-sqlite3` natív modul nem fordul vagy nem töltődik be Node 26 alatt | a csomag használhatatlan, a CI elbukik                      | a végrehajtás első fázisa ezt méri helyben és CI-ban, még a séma megírása előtt (O-7)                                                        |
| A dokumentum verzió túl gyakran nő                                         | hosszú átalakító lánc, sok fixture                          | a verzió csak visszafelé nem kompatibilis változásnál nő; opcionális mező felvétele nem növeli (5.2)                                         |
| A pillanatkép dokumentum nagyra nő nagy gráfnál                            | lassabb futás megnyitás                                     | a pillanatkép külön táblában áll, a futás lista nem érinti (4.9); konkrét méretküszöböt nem rögzítünk, mert nincs rá mérésünk                |
| Az esemény tábla korlátlanul nő                                            | lassabb transcript és nagyobb fájl                          | nyitott kérdés (O-4); a `run_event_run_id_idx` a lekérdezést tartja, de a fájlméretre nincs szabályunk                                       |
| Titok kerül a node configba egy jövőbeli mezőn keresztül                   | a gyökér `CLAUDE.md` szabálya sérül                         | a config unió minden hitelesítési mezője **név** típusú (`envNames`, `authEnvName`), és van rá spec (12.3)                                   |
| Az `agent` és a `web` csomag ugyanezeket a domain típusokat akarja majd    | típus duplikálás vagy tiltott függőségi él                  | a 8. szekció nyitott lépése kimondja, hova költöznek a típusok, és mi az előfeltétele; a jelen spec ezt nem hajtja végre, de nem is zárja ki |
| A `db` új `provider-capability` függősége rétegsértést okoz                | `bun run check:graph` piros                                 | L2 -> L1 él, szigorúan csökkenő; a `check:graph` minden lépés végén fut                                                                      |

## 15. Elfogadási kritériumok

1. A `packages/db/src` alatt pontosan 12 téma mappa áll, a 8. szekció listája szerint, plusz az `index.ts` barrel. Egyetlen fájl sem áll közvetlenül a `src/` alatt a barrelen kívül, és egyetlen téma mappában sincs további alkönyvtár.
2. A `packages/db` csomagban `CLAUDE.md` kizárólag a csomag gyökerében van, és a `## Fájlok` táblázata mind a 12 téma mappát felsorolja, felelősség leírással. A `bun run docs:check` nulla kilépési kóddal fut.
3. A `packages/db/src/index.ts` csak nevesített újraexportot tartalmaz, `export *` nélkül, és az `IS_DB_PLACEHOLDER` konstans megszűnt.
4. A barrel **nem** exportál Drizzle tábla objektumot, `drizzle()` példányt, `BetterSQLite3Database` típust vagy `better-sqlite3` szimbólumot. Ezt egy `.spec.ts` mechanikusan igazolja a barrel exportált kulcsainak listáján.
5. A séma pontosan 10 saját táblát definiál: `workflow`, `workflow_node`, `workflow_edge`, `workflow_run`, `run_graph_snapshot`, `step_run`, `run_event`, `human_approval`, `app_setting`, `provider_concurrency_limit`. A migrált adatbázis `sqlite_master` tartalma ezt igazolja, a `__drizzle_migrations` táblával együtt.
6. Minden idegen kulcs a 4.15 szekció lánca szerinti `ON DELETE` viselkedéssel áll, és a migrált adatbázis `PRAGMA foreign_key_list` kimenete ezt igazolja táblánként.
7. Egy `workflow` sor törlése után a hozzá tartozó `workflow_node`, `workflow_edge`, `workflow_run`, `run_graph_snapshot`, `step_run`, `run_event` és `human_approval` sorok száma nulla, beleértve az al-workflow futásait is. Ezt futtatott teszt igazolja, nem érvelés.
8. A séma egyetlen táblájában sincs `deleted_at`, `archived`, `is_deleted` vagy hasonló oszlop, és a repository nem ad soft delete műveletet.
9. A `run_event.id` `INTEGER PRIMARY KEY AUTOINCREMENT`, és a `sqlite_sequence` tábla létezik a migrált adatbázisban. Egy teszt igazolja, hogy a legnagyobb azonosítójú sor törlése után a következő beszúrás **nem** használja újra az azonosítót.
10. A `run_event` normalizált oszlopkészlete pontosan a 6.2 táblázat szerinti, és minden SDK eredetű normalizált oszlop nullable. A táblában nincs költség oszlop.
11. Nincs olyan `run_event` normalizált oszlop, ami olyan SDK mezőre hivatkozik, amit a `docs/research/2026-08-26-agent-sdk-minimax.md` vagy a `docs/research/2026-08-26-spec000-kiertekeles.md` nem nevez meg.
12. Az `openDatabase` minden kapcsolaton lefuttatja a `PRAGMA foreign_keys = ON` parancsot, még a migrációk és minden tranzakció előtt. Egy teszt igazolja, hogy a pragma nélkül nyitott kapcsolaton a kaszkád nem fut le, a rendes úton nyitottan igen.
13. Az `openDatabase` fájl alapú adatbázison `journal_mode = wal` értéket állít be, `:memory:` adatbázison nem próbálja meg. Mindkét ágat teszt fedi.
14. A `better-sqlite3` `timeout` opciója a dokumentált alapértéken marad, és a kódban nincs kézzel megadott `busy_timeout` érték.
15. A `startRun` az egyetlen beszúrási út a `workflow_run` táblára, és egy tranzakcióban írja a futást, a `run_graph_snapshot` sort és a `run_started` eseményt. Nincs olyan exportált művelet, ami pillanatkép nélküli futást tudna létrehozni.
16. Létezik `GRAPH_DOCUMENT_VERSION` egész literál, és a pillanatkép dokumentum `version` mezője ezt hordozza. A `run_graph_snapshot.document_version` oszlop értéke minden sorban megegyezik a dokumentumban álló verzióval.
17. A `readGraphSnapshot` `Outcome` értéket ad vissza, kimerítő `switch` szerkezettel a verziókon, és ismeretlen verzióra nevesített hibaágat ad. Kivételt nem dob.
18. Minden kiadott dokumentumverzióhoz létezik commitolt fixture és `.spec.ts`, ami igazolja, hogy a mai olvasó megjelenítendő dokumentumot ad belőle.
19. A `run_graph_snapshot` sor módosítási kísérlete hibázik. A repository rétegben nincs olyan exportált művelet, ami a táblát módosítja.
20. Egy futás pillanatképe akkor is a futáskori gráfot adja vissza, ha a workflow-t azóta átírták, a node-jait törölték vagy a globális alapértelmezett providert megváltoztatták. Ezt futtatott teszt igazolja.
21. A `step_run.node_id` **nem** idegen kulcs a `workflow_node` táblára, és egy node törlése a szerkesztőben nem érinti a korábbi futások lépés futásait.
22. A `RunStatus` hat, a `StepRunStatus` nyolc értéket vesz fel, a 7.1 és a 7.2 táblázat szerint, és mindkettőhöz tartozik átmeneti szabály függvény kimerítő `switch` szerkezettel.
23. Minden érvénytelen állapotátmenet `illegal_status_transition` hibaágat ad, és minden érvényes átmenet sikerül. Ezt átmenetenként egy-egy teszteset igazolja.
24. Minden állapotváltó `UPDATE` tartalmazza a várt jelenlegi állapotot a `WHERE` feltételben, és nulla módosított sor esetén hibaágat ad. A repository nem exportál általános `updateStatus` metódust.
25. Az indulási helyreállítás minden `pending` és `running` futást, valamint a hozzájuk tartozó nem terminális lépés futásokat `interrupted` állapotba viszi, és futásonként egy `run_interrupted` eseményt ír, egy tranzakcióban.
26. Az `interrupted` állapot terminális: nincs belőle kimenő átmenet sem a futás, sem a lépés futás állapotgépben.
27. Az újraindítás új `workflow_run` sort és új pillanatképet hoz létre, a `restarted_from_run_id` mezőben rögzített származással.
28. A `deleteWorkflow` bemeneti típusa kötelezően tartalmazza az `acknowledgeIrreversible: true` literált, és nélküle a hívás nem fordul le. Létezik `summarizeDeletion` művelet, ami a törlendő futás és esemény darabszámot adja.
29. Az `AgentStepConfig` MCP szerver mezője **kizárólag** env változó nevet tárol (`envNames`, `authEnvName`), értéket nem. A bemeneti típus nem tartalmaz értékmezőt, és ezt teszt igazolja.
30. A `packages/db` `dependencies` mezője: `core`, `logger`, `typeguards`, `provider-capability`. A `bun run check:graph` nulla kilépési kóddal fut, minden él szigorúan csökkenő rétegszám felé mutat.
31. A `@easter-workflow-builder/provider-capability` csomag tartalmaz `provider-id` téma mappát egyetlen `provider-id.ts` fájllal, duplikált mappaszint nélkül, és a `provider-registry` `ProviderRegistry` interfésze ezt a uniót használja kulcsként.
32. A `packages/db/src` alatt nincs `any` és nincs `as`. Minden JSON oszlop `.$type<unknown>()` alakú, és a szűkítést typeguard végzi. A `bun run lint` nulla kilépési kóddal fut.
33. Minden domain typeguardhoz tartozik saját `.spec.ts` a megvalósítás mellett, azonos téma mappában.
34. A migrációk a `packages/db/drizzle` mappában, gitbe commitolva állnak, és a `migrate()` hívás az `openDatabase` része, a hálózati kapcsolatok fogadása előtt.
35. A repóban nincs `drizzle-kit push` hívás sem npm scriptben, sem CI workflowban, sem dokumentációban ajánlásként.
36. Létezik drift ellenőrző wrapper a `tooling/scripts` alatt, ami nem nulla kilépési kóddal fut, ha a séma és a commitolt migrációk eltérnek, és nulla kóddal, ha nem.
37. Az `EASTER_DB_FILE` szerepel a `turbo.json` `globalPassThroughEnv` listájában, a `.data/` és az SQLite kísérőfájl minta pedig a `.gitignore` fájlban.
38. Minden `.spec.ts` valós `better-sqlite3` adatbázis ellen fut, `:memory:` példányon, ami a commitolt migrációkkal épül fel. Mockolt adatbázis nincs.
39. A `bun run test` nulla kilépési kóddal fut, és a lefedettség mind a négy metrikán 100 százalék. A `vitest.config.ts` `coverage.exclude` listája egyetlen sorral sem bővült.
40. A 12.4 szekcióban felsorolt mind a 11 hibaosztályhoz tartozik olyan teszteset, ami ténylegesen előidézi.
41. A `provider_concurrency_limit` tábla a migráció után **üres**, és sem a kódban, sem a migrációban nincs szállított párhuzamossági alapérték. Az `app_setting.default_provider_id` NULL a migráció után.
42. A `readEventsSince` `limit` paramétere kötelező, alapérték nélkül.
43. A 13. szekció mind a nyolc nyitott kérdése vagy lezárt (futtatott mérés vagy hivatalos forrás megnevezésével, a `docs/research/` alá vezetve), vagy nyitottként áll, a "mi a viselkedés addig" és a "mi zárná le" mezővel kitöltve. Tippeléssel lezárt pont nincs.
44. A `bun run typecheck`, `bun run lint`, `bun run format:check`, `bun run test`, `bun run build`, `bun run docs:check`, `bun run check:casing` és `bun run check:graph` mind a nyolc parancs nulla kilépési kóddal fut a teljes workspace-en.

## 16. Kapcsolódó dokumentumok

- [`../plan/PLAN-003-domain-perzisztencia.md`](../plan/PLAN-003-domain-perzisztencia.md): a végrehajtási terv
- [`SPEC-002-csomag-architektura.md`](SPEC-002-csomag-architektura.md): a csomagtérkép, a rétegzés és a mappa konvenció
- [`SPEC-001-monorepo-toolchain.md`](SPEC-001-monorepo-toolchain.md): a minőségi kapuk, a lint szabályok és a coverage küszöb
- [`SPEC-000-provider-wire-measurement.md`](SPEC-000-provider-wire-measurement.md): a provider drótszintű mérés
- [`../research/2026-08-26-agent-sdk-minimax.md`](../research/2026-08-26-agent-sdk-minimax.md): az `SDKMessage` unió, a session kezelés, a hookok
- [`../research/2026-08-26-spec000-kiertekeles.md`](../research/2026-08-26-spec000-kiertekeles.md): a mért provider korlátok és a tervezési következmények
- [`../research/2026-08-26-toolchain.md`](../research/2026-08-26-toolchain.md): a rögzített verziók
