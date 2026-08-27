# packages/db

## Mi ez a mappa

Drizzle séma, migrációk, repository-k (SPEC-003). A csomag téma mappánként épül fel; ez a fájl
a végrehajtás alatt folyamatosan bővül, ahogy egy-egy téma mappa elkészül. A barrel
(`src/index.ts`) a `sqlite-connection` téma óta valódi exportot ad, a korábbi placeholder
(`IS_DB_PLACEHOLDER`) megszűnt (SPEC-002 6.6 6. szabálya, T-003-9).

## Fájlok

| Mappa                | Tartalom                                                                                                                                                                                                                                                                                                                   |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `database-file/`     | az adatbázis fájl helyének feloldása: `EASTER_DB_FILE` env változó neve, fejlesztői alapértelmezés, könyvtár létrehozása (SPEC-003 10.1 szekció)                                                                                                                                                                           |
| `sqlite-connection/` | `openDatabase`, a `DatabaseContext` felület, a pragma sorrend, a migráció bekötése (SPEC-003 10.2 szekció), a tranzakció és a zárás; a repository mezők a következő témák elkészültével bővülnek ide                                                                                                                       |
| `migration/`         | a migrációs mappa útvonala (`MIGRATIONS_FOLDER`) és a `migrate()` hívás `Outcome` hibaágra burkolása; nem barrel export, `openDatabase` belső részlete                                                                                                                                                                     |
| `workflow-graph/`    | `workflow`, `workflow_node`, `workflow_edge` tábla (SPEC-003 4.1, 4.2, 4.7 szekció); a `NodeType` unió, a node config unió, az `AgentStepConfig` és a typeguardjaik (T-003-11); a `WorkflowRepository` (T-003-12)                                                                                                          |
| `graph-snapshot/`    | a pillanatkép dokumentum típusa és verzió uniója, a `GRAPH_DOCUMENT_VERSION`, az RFC 8785 kanonizáló, a `sha256` lenyomat képzés, a `resolveSnapshotReuse` döntő függvény, a verziódiszpécser `readGraphSnapshot` és a typeguardok (SPEC-003 5. szekció, T-003-14); a `graph_snapshot` tábla a T-003-15 lépésben kerül ide |

A `drizzle.config.ts` a csomag gyökerén áll, a `drizzle/` mappa a generált, gitbe commitolt SQL
migrációkat és a hozzájuk tartozó snapshotot tartalmazza. A `schema` mező explicit fájllista,
nem glob: a `.spec.ts` fájlok `vitest` importja miatt a drizzle-kit esbuild alapú CJS bundlere
elhasalna egy `./src/**/*.ts` mintán, a hivatalos config doksi pedig nem dokumentál negációs
glob mintát erre a mezőre. Új tábla fájlt ezért a `drizzle.config.ts` listájába is fel kell
venni.

A további, a SPEC-003 8. szekciója szerinti téma mappák (`workflow-run`, `step-run`,
`run-event`, `human-approval`, `app-setting`, `provider-concurrency`, `run-recovery`) a
végrehajtás további lépéseiben keletkeznek.

**Tábla séma tesztelése: `getTableConfig` kell a 100%-os function coverage-höz.** A
`sqliteTable()` harmadik argumentuma (index lista) és a `.references(() => ...)` idegen kulcs
callback lusta függvény: sima insert/select lekérdezés soha nem hívja meg őket, a
`drizzle-orm/sqlite-core` `getTableConfig(table)` viszont igen, és visszaadja az
`indexes`/`foreignKeys` tömböt is ellenőrzésre. Minden tábla saját `.spec.ts` fájljában ezért
a valós SQLite ellen futó insert/select tesztek mellett egy `getTableConfig`-ra épülő teszt is
kell, ami az index nevét/oszlopát és az idegen kulcs `onDelete`/cél tábla párját assertálja
(lásd `workflow.spec.ts`, `workflow-node.spec.ts`, `workflow-edge.spec.ts`), különben a
`workflow-graph` mappa function/line coverage-e a spec 12.4 100%-os küszöbe alatt marad.

## A node config unió és az `AgentStepConfig` (T-003-11)

A `workflow-graph` téma mappában a domain típusok és a typeguardjaik egy koncepció egy fájl
bontásban állnak, alkönyvtár nélkül (SPEC-002 6. szekció, egy szint mély): `node-type.ts`,
`node-config.ts` (az unió és mind a tíz ág), `agent-step-config.ts`, `storable-mcp-server.ts`,
`sandbox-config.ts`, `engine-hook-id.ts`, `session-mode.ts`, `script-config.ts`, és a guardok
`is-` előtaggal (`is-node-type.ts`, `is-node-config.ts`, `is-agent-step-config.ts`, plusz a
`is-string-array.ts` segéd, amit a téma több guardja használ). Egyik sem kerül a barrelbe: a
publikus felületet a repository réteg adja majd (T-003-12).

**Titok nem tárolható.** A `StorableMcpServer` a négy SDK variánsból hármat enged (`stdio`,
`sse`, `http`); az `sdk` variáns élő objektumpéldányt hordoz, tehát nem szerializálható. A
`stdio` ág `env` értékrekord helyett `envNames`, az `sse`/`http` ág fejléc érték helyett
`authEnvName` mezőt tárol, mindkettő env változó NÉV. A guard elutasítja azt az alakot, ami
`env` értékrekordot hozna.

**Nyitott alakok, amiket a guard szándékosan nem szűkít.** Ahol a research és a hivatalos
dokumentáció nem rögzíti a pontos alakot, ott tippelés helyett nyitott a típus, és ez a lista
zárja le majd egy külön lépés:

| Hol                                                                       | Mi nyitott                                                                                                                                |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `SandboxConfig.network`, `.filesystem`                                    | a hivatalos sandbox doksi szerint összetett objektum (allowlist, deny szabályok, `disabled` kapcsoló); az SDK `Options` alakja nem ismert |
| `SandboxConfig.allowUnsandboxedCommands`, `.ignoreViolations`, `.ripgrep` | a lista és a logikai alak között nincs döntő forrás                                                                                       |
| `JoinMergeSettings`                                                       | a SPEC-003 4.3 egyetlen mezőt sem nevez meg az összefűzési szabályra                                                                      |
| `StartInputField.valueKind`                                               | a SPEC-003 nem sorolja fel az értékkészletet, ezért szabad szöveg                                                                         |
| `AgentStepConfig.agents` értékei                                          | a research nem rögzíti az `AgentDefinition` mezőlistáját, és az SDK verzióhoz kötött                                                      |

Amit a guard **kikényszerít**: a `loop.maxIterations`, az `error_handler.maxAttempts` és a
`backoffMs` minden eleme egész és pozitív (SPEC-003 4.3, alapérték nélkül), a `join` mindhárom
módja a saját alobjektum alakját kapja, és a tíz ágú `switch` a
`@typescript-eslint/switch-exhaustiveness-check` szabály miatt nem tud lemaradni egy típusról.

## A `WorkflowRepository` (T-003-12)

A `workflow-repository.ts` a `createWorkflow`, `updateWorkflow`, `getWorkflow`, `listWorkflows`,
`replaceGraph`, `readGraph`, `summarizeDeletion`, `deleteWorkflow` műveletet adja, `openDatabase`
kötve be a `DatabaseContext.workflows` mezőbe (`sqlite-connection/open-database.ts`, ugyanazzal a
`transaction()` függvénnyel, amit a `replaceGraph` és a `deleteWorkflow` is használ). A barrel csak
a `WorkflowRepository` típust és a hozzá tartozó bemeneti/kimeneti típusokat exportálja, a
`createWorkflowRepository` factory függvényt nem (SPEC-003 9.3).

**Döntések, ahol a spec nem volt kimerítő.** Az `id` a repositoryban generált UUID
(`node:crypto` `randomUUID()`), a `createdAtMs`/`updatedAtMs` a hívás pillanatában generált
`Date` (a `timestamp_ms` mód ezt várja, lásd `workflow.ts`). A `listWorkflows` az
`updated_at_ms` oszlop szerint **csökkenő** sorrendben ad listát, mert ez az egyetlen index a
táblán, és a legutóbb módosított workflow a leghasznosabb elöl. Az `updateWorkflow` a `name`,
`description`, `providerId` mezőt **együtt** várja (teljes csere, nem részleges patch): a spec
nem részletezi, és egy valódi részleges patch nem tudná typeszinten megkülönböztetni a "mezőt
nem küldtem" és a "mezőt explicit null-ra állítom" esetet `| null` mezőkkel. A `replaceGraph`
bemeneti node alakja (`WorkflowNodeInput`) nem hordoz külön `type` mezőt: a `config.type`
diszkriminátor már megadja, a `workflow_node.type` oszlopot ebből tölti a repository.

**A `provider_id` typeguard határa csak olvasáskor él.** A `workflow.provider_id` oszlopnak
nincs DB szintű `CHECK`-je (4.1 szekció), a séma szinten sima `string | null`. Íráskor
(`createWorkflow`/`updateWorkflow`) a bemenet már TypeScript szinten `ProviderId | null`, nincs
mit szűkíteni. Olvasáskor (`getWorkflow`/`listWorkflows`) a nyers oszlopérték nem bizonyíték a
típusra, ezért az `isProviderId` guard szűkíti; ha egy sor korrupt (pl. egy időközben törölt
provider azonosítója maradt bent), `invalid_provider_id` hibaágat ad. Ugyanez a minta a
`readGraph`-ban a node `config` oszlopára (`isNodeConfig`, `corrupt_node_config` hibaosztály).

**Két nyitott pont, a T-003-16 zárja le őket (PLAN-003, a T-003-12 sora utáni bekezdés).**

- `summarizeDeletion`: a `runCount`/`eventCount`/`snapshotCount` mező kényszerűen `0`, mert a
  `workflow_run`/`run_event`/`graph_snapshot` tábla még nem létezik (F5 fázis). Jelölve: magyar
  "NYITOTT PONT" komment a `summarizeDeletion` függvényben, `workflow-repository.ts`.
- `deleteWorkflow`: a `graph_snapshot` árva söprése (4.15 szekció) nem futtatható, mert a
  `graph_snapshot` tábla még nem létezik. Jelölve: magyar "NYITOTT PONT" komment a
  `deleteWorkflow` függvény végén, a `DELETE FROM graph_snapshot WHERE hash NOT IN (...)` SQL
  szó szerint a kommentben, `workflow-repository.ts`.

## A gráf pillanatkép kanonizálása és a fixture (T-003-14)

A `graph-snapshot` téma mappa ebben a lépésben **tisztán TypeScript logika**, se Drizzle
tábla, se SQLite import nincs benne; a `graph_snapshot` tábla a T-003-15 lépésé. Egyik
fájlja sem kerül a barrelbe: a következő lépés (`WorkflowRunRepository`, T-003-16) belső,
relatív importtal használja őket, ugyanúgy, ahogy a `workflow-graph` node config típusai sem
kerültek ki.

**A kanonizáló a kulcsokat maga fűzi össze.** A `canonicalizeSnapshotDocument` kulcsonként
`JSON.stringify(kulcs) + ':' + kanonikus(érték)` alakban építi a kimenetet, és **soha nem ad
újraépített objektumot a `JSON.stringify` hívásnak**. Ez nem stílus kérdés (SPEC-003 5.6, 2.
pont, F-26): az egész indexű kulcsokat (`"9"`, `"10"`) a `JSON.stringify` mindig növekvő
számsorrendben írja ki, az RFC 8785 viszont UTF-16 sorrendet ír elő, ahol a `"10"` megelőzi a
`"9"` kulcsot. A rendezés `toSorted(compareUtf16CodeUnits)` hívással történik: az explicit
összehasonlító pontosan az alapértelmezett `sort()` UTF-16 sorrendjét adja, de a
`unicorn/require-array-sort-compare` szabály összehasonlító nélkül nem engedné, a
`sonarjs/no-alphabetical-sort` pedig `localeCompare`-t javasolna, ami locale függő, tehát erre
a feladatra hibás lenne.

**Fixture fájl a téma mappában, alkönyvtár nélkül.** A commitolt regressziós fixture a
`graph-snapshot-document-v1-fixture.json`, közvetlenül a téma mappában (a SPEC-003 1.
kritériuma tiltja az alkönyvtárat), mellette a `graph-snapshot-document-v1-fixture.spec.ts`,
ami betölti, kanonizálja, és a kapott lenyomatot egy **kódba írt 64 karakteres literállal**
veti össze (48. kritérium). Ez a teszt bukik meg, ha a kanonizálás vagy a lenyomat algoritmus
valaha észrevétlenül megváltozik; ilyenkor a kanonizálót kell visszaállítani, a literált nem
szabad felülírni. Új dokumentumverzió felvételekor új fixture fájl és új literál kell, a régi
marad.

**A `readGraphSnapshot` `switch`-e két lint kivétellel áll** (`sonarjs/no-small-switch`,
`@typescript-eslint/no-unnecessary-condition`), mert a `GraphSnapshotDocumentVersion` unió ma
egytagú. A szerkezet nem díszítés: az `if` alakra a `switch-exhaustiveness-check` nem ad
hibát, tehát csak a `switch` kényszeríti ki, hogy egy jövőbeli verzió felvétele fordítási
hibát adjon, amíg az ág hiányzik. Az ismeretlen verziót a hívó **a `switch` előtt** zárja ki
az `isGraphSnapshotDocumentVersion` guarddal, `unknown_graph_document_version` hibaággal.

## `Outcome` hibaosztály konvenció

A csomag a megosztott `Outcome<T>` típust használja a `@easter-workflow-builder/core`
csomagból, módosítás nélkül (`{ kind: 'error'; message: string }`). A SPEC-003 12.4 szekciója
"hibaosztályokat" nevez meg (pl. `database_closed`, `not_found`); ezek nem külön mezőt kapnak,
hanem a hibaosztály neve szó szerint, zárójelben szerepel a `message` szövegében (pl. "... le
van zárva (database_closed)."), hogy a tesztek stabilan `.toContain(...)` tudjanak rá
ellenőrizni, a hibaüzenet mégis emberi nyelvű maradjon. Ezt a mintát minden további téma
követi.

## Függőségi irány

A `db` az `@easter-workflow-builder/core`, az `@easter-workflow-builder/logger`, az
`@easter-workflow-builder/typeguards` és az `@easter-workflow-builder/provider-capability`
csomagtól függ (`dependencies`, lásd `package.json`), L2 réteg (SPEC-002 4. szekció). Külső
futásidejű függősége a `drizzle-orm` és a `better-sqlite3`, fejlesztői függősége a
`@types/better-sqlite3` és a `drizzle-kit`, mind a négy literál verzióval rögzítve (SPEC-003
10.4 szekció, T-003-7).

**`skipLibCheck: true` a `tsconfig.json`-ban.** A `drizzle-orm@0.45.2` egyetlen csomagban
szállítja az összes dialektus deklarációs fájlját, és ezek egymás között típushibásak
`skipLibCheck` nélkül, dokumentált felsőáramú hiba
(https://github.com/drizzle-team/drizzle-orm/issues/879,
https://github.com/drizzle-team/drizzle-orm/issues/4299,
https://github.com/drizzle-team/drizzle-orm/issues/4818), nem a saját kódunké.

## Szabályok

Titok soha nem kerül ide: a DB csak env változó nevet tárol, sosem értéket (`database-file`
téma: `ENV_EASTER_DB_FILE` a változó neve, az értéket minden hívás az `EnvironmentReader`
paraméterből olvassa). A `src/` alatti mappaszerkezet a téma szerinti konvenciót követi
(SPEC-003 8. szekció), egy szint mélyen, a barrelen kívül más fájl nem áll közvetlenül a
`src/` alatt. A barrel nem exportál Drizzle tábla objektumot, `drizzle()` példányt vagy
`better-sqlite3` szimbólumot (SPEC-003 9.3 szekció).

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-001-monorepo-toolchain.md`](../../docs/spec/SPEC-001-monorepo-toolchain.md), 3. szekció
- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 4. és 6. szekció
- [`../../docs/spec/SPEC-003-domain-perzisztencia.md`](../../docs/spec/SPEC-003-domain-perzisztencia.md), 8. és 10. szekció
- [`../../docs/plan/PLAN-003-domain-perzisztencia.md`](../../docs/plan/PLAN-003-domain-perzisztencia.md)
