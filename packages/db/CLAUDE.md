# packages/db

## Mi ez a mappa

Drizzle séma, migrációk, repository-k (SPEC-003). A csomag téma mappánként épül fel; ez a fájl
a végrehajtás alatt folyamatosan bővül, ahogy egy-egy téma mappa elkészül. A barrel
(`src/index.ts`) a `sqlite-connection` téma óta valódi exportot ad, a korábbi placeholder
(`IS_DB_PLACEHOLDER`) megszűnt (SPEC-002 6.6 6. szabálya, T-003-9).

## Fájlok

| Mappa                | Tartalom                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `database-file/`     | az adatbázis fájl helyének feloldása: `EASTER_DB_FILE` env változó neve, fejlesztői alapértelmezés, könyvtár létrehozása (SPEC-003 10.1 szekció)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `sqlite-connection/` | `openDatabase`, a `DatabaseContext` felület, a pragma sorrend, a migráció bekötése (SPEC-003 10.2 szekció), a tranzakció és a zárás; a repository mezők a következő témák elkészültével bővülnek ide                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `migration/`         | a migrációs mappa útvonala (`MIGRATIONS_FOLDER`) és a `migrate()` hívás `Outcome` hibaágra burkolása; nem barrel export, `openDatabase` belső részlete                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `workflow-graph/`    | `workflow`, `workflow_node`, `workflow_edge` tábla (SPEC-003 4.1, 4.2, 4.7 szekció); a `NodeType` unió, a node config unió, az `AgentStepConfig` és a typeguardjaik (T-003-11); a `WorkflowRepository` (T-003-12)                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `graph-snapshot/`    | a pillanatkép dokumentum típusa és verzió uniója, a `GRAPH_DOCUMENT_VERSION`, az RFC 8785 kanonizáló, a `sha256` lenyomat képzés, a `resolveSnapshotReuse` döntő függvény, a verziódiszpécser `readGraphSnapshot` és a typeguardok (SPEC-003 5. szekció, T-003-14); a `graph_snapshot` tábla (`hash` elsődleges kulcs, `graph_snapshot_version_idx` index, nincs idegen kulcsa) és a `graph_snapshot_no_update` `BEFORE UPDATE` trigger, ami minden módosítási kísérletet `SQLITE_CONSTRAINT_TRIGGER` hibával buktat meg (SPEC-003 4.9 és 5.5 szekció, T-003-15)                                                                                                                         |
| `workflow-run/`      | a `workflow_run` tábla (SPEC-003 4.8 szekció): önhivatkozó `root_run_id` (`ON DELETE CASCADE`) és `restarted_from_run_id` (`ON DELETE SET NULL`) idegen kulcs, `graph_snapshot_hash` idegen kulcs `ON DELETE RESTRICT` viselkedéssel a `graph_snapshot` táblára (F-27, F-28, 51. kritérium), négy index; a `RunStatus` hat állapota és a `canTransitionRunStatus` átmeneti szabály függvény, kimerítő `switch` szerkezettel (SPEC-003 7.1 és 7.3 szekció, T-003-13); a `WorkflowRunRepository`: `startRun` (az egyetlen beszúrási út, a pillanatkép feloldásával, T-003-16), `getRun`/`listRuns`/`listRunsForWorkflow`, a négy compare-and-set állapotváltó és `readSnapshot` (T-003-16) |

A `drizzle.config.ts` a csomag gyökerén áll, a `drizzle/` mappa a generált, gitbe commitolt SQL
migrációkat és a hozzájuk tartozó snapshotot tartalmazza. A `schema` mező explicit fájllista,
nem glob: a `.spec.ts` fájlok `vitest` importja miatt a drizzle-kit esbuild alapú CJS bundlere
elhasalna egy `./src/**/*.ts` mintán, a hivatalos config doksi pedig nem dokumentál negációs
glob mintát erre a mezőre. Új tábla fájlt ezért a `drizzle.config.ts` listájába is fel kell
venni.

A további, a SPEC-003 8. szekciója szerinti téma mappák (`step-run`, `run-event`,
`human-approval`, `app-setting`, `provider-concurrency`, `run-recovery`) a végrehajtás további
lépéseiben keletkeznek.

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

**A T-003-12 két nyitott pontja lezárva (T-003-16, PLAN-003, a T-003-12 sora utáni bekezdés).**

- `summarizeDeletion`: a `runCount` a ténylegesen törlődő `workflow_run` sorok pontos száma,
  a `workflow_id = ?` közvetlen találatok **és** a `root_run_id` önhivatkozó kaszkádja miatt
  törlődő, más workflow-hoz tartozó al-workflow futások uniója (4.15 szekció, F-11: egy gyökér
  futás törlése a saját al-workflow futásait is elviszi, azok workflow-jától függetlenül). A
  `snapshotCount` azon `graph_snapshot` sorok száma, amikre a törlés után **egyetlen** megmaradó
  `workflow_run` sor sem hivatkozna (tehát árvává válnának); egy megosztott sor, amire egy
  túlélő, más workflow-hoz tartozó futás is mutat, nem számít bele. Az `eventCount` NYITOTT PONT
  marad, mert a `run_event` tábla a T-003-19 lépésig nem létezik; jelölve magyar "NYITOTT PONT"
  komment a `summarizeDeletion` függvényben, `workflow-repository.ts`.
- `deleteWorkflow`: a `workflow` sor törlése (és vele a kaszkád) után, ugyanabban a
  tranzakcióban lefut az árva pillanatkép söprés, szó szerint a 4.15 szekció SQL-jével:
  `DELETE FROM graph_snapshot WHERE hash NOT IN (SELECT graph_snapshot_hash FROM workflow_run)`,
  nyers `sql` sablonnal (`drizzle-orm` `sql` export), nem a típusos Drizzle delete-builderrel,
  mert a feltétel egy korrelálatlan alkérdés a másik táblára.

Mindkét függvény most már importálja a `workflowRunTable`-t a `workflow-run` témából
(`../workflow-run/workflow-run.ts`), ugyanaz a mintát, mint amit a `workflow-run.ts` már
alkalmazott a `workflow-graph` és a `graph-snapshot` téma felé (SPEC-003 8. szekció: a téma
mappák egy csomagon belüli, relatív importtal hivatkoznak egymásra, a barrelen kívül).

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

## A `graph_snapshot` tábla és a megváltoztathatatlansági trigger (T-003-15)

A `graph-snapshot.ts` a `graph_snapshot` tábla Drizzle definíciója: `hash` elsődleges kulcs
(a `document` sha256 lenyomata, 64 karakter kisbetűs hex), `document_version`, `document`
(`text('document', { mode: 'json' }).$type<unknown>()`) és `first_captured_at_ms`, plusz a
`graph_snapshot_version_idx` index a `document_version` oszlopon. **Nincs idegen kulcsa
kifelé**: ez a szülő tábla, a `workflow_run` (T-003-13) fog rá mutatni. A `graphSnapshotTable`
objektum **nem** kerül a barrelbe (SPEC-002 6.6 5. szabálya, SPEC-003 9.3 szekció).

A tábla migrációja a `drizzle-kit generate` géppel generált `drizzle/0001_yellow_calypso.sql`.
A megváltoztathatatlansági trigger a T-003-5/O-6 próbában már ellenőrzött, szó szerinti SQL,
a `drizzle-kit generate --custom --name=block-graph-snapshot-update` üres migrációba kézzel
beírva (`drizzle/0002_block-graph-snapshot-update.sql`):

```sql
CREATE TRIGGER graph_snapshot_no_update
BEFORE UPDATE ON graph_snapshot
BEGIN
  SELECT RAISE(ABORT, 'graph_snapshot is immutable');
END;
```

A `graph-snapshot-immutability.spec.ts` egy saját `better-sqlite3` + `drizzle()` példányt nyit
(a `DatabaseContext` nem exportálja a nyers handle-t), lefuttatja rajta a commitolt
migrációkat, majd nyers SQL `UPDATE`-tel próbálkozik: a hívás `SqliteDatabase.SqliteError`
példányt dob, `code: 'SQLITE_CONSTRAINT_TRIGGER'` és `message: 'graph_snapshot is immutable'`
értékkel, a sor tartalma változatlan marad, az azonos tesztben lefuttatott `INSERT` és `DELETE`
sikeres. Ezzel a SPEC-003 5.5 szekció mindkét védelme megvalósult: a repository szintű
zártság (a barrel nem exportál módosító műveletet a táblára) és az adatbázis szintű trigger is.

## A `WorkflowRunRepository` (T-003-16)

A `workflow-run-repository.ts` a `startRun`, `getRun`, `listRuns`, `listRunsForWorkflow`, a négy
compare-and-set állapotváltó (`markRunRunning`, `markRunSucceeded`, `markRunFailed`,
`markRunCancelled`) és a `readSnapshot` műveletet adja, `openDatabase` köti be a
`DatabaseContext.runs` mezőbe, ugyanazzal a `transaction()` függvénnyel, amit a `workflows` mező
is használ. A barrel csak a `WorkflowRunRepository`, `StartRunInput`, `StartRunParentContext` és
`WorkflowRunRecord` típust exportálja, a `createWorkflowRunRepository` factory függvényt nem
(SPEC-003 9.3, ugyanaz a minta, mint a `WorkflowRepository`-nél).

**A `StartRunInput` alakja, a spec nem volt kimerítő.** A `graphSnapshotDocument` már kész,
feloldott `GraphSnapshotDocument`: a háromszintű provider feloldást és a pillanatkép
ÖSSZEÁLLÍTÁSÁT (a workflow gráfjának kiolvasását és dokumentummá alakítását) a motor
(`@easter-workflow-builder/engine`) végzi egy későbbi specifikációban, a `startRun` csak a kész
dokumentumot fogadja. A `providerId` (`ProviderId`, kötelező) szintén a motor által már feloldott
érték. Az al-workflow hívás szülő kontextusát a `parent?: StartRunParentContext` mező hordozza
(`{ rootRunId, depth, workflowAncestry }`), NEM külön `parentRunId` mező: a `workflow_run`
táblának nincs ilyen oszlopa (a szülő-gyerek kapcsolatot a `step_run.sub_workflow_run_id` fogja
hordozni, T-003-17/18), a `workflow_run` csak a `root_run_id`-t és a `depth`/`workflow_ancestry`
származtatott mezőket tárolja. Ha a hívó nem ad meg `parent`-et, a futás gyökér: `rootRunId` a
saját, most generált `id`, `depth` `0`, `workflowAncestry` a `[workflowId]` egyelemű lista
(SPEC-003 4.8 szekció). Ha megadja, a repository ebből vezeti le a gyerek futás mezőit: azonos
`rootRunId`, `depth + 1`, `[...szülő lista, workflowId]`.

**A pillanatkép beszúrás bájt-egyezése (45. kritérium), a kritikus tervezési döntés.** A
`graph_snapshot.document` Drizzle oszlop `mode: 'json'`, tehát a típusos `insert(graphSnapshotTable)`
íráskor `JSON.stringify`-t futtatna a kanonikus szövegből visszaparsolt objektumon
(`drizzle-orm/sqlite-core/columns/text.js`, `SQLiteTextJson.mapToDriverValue`). Ez **nem**
garantáltan ugyanaz a bájtsor, mint a kanonikus szöveg: a `JSON.stringify` az egész indexű
kulcsokat (`"9"`, `"10"`) mindig növekvő számsorrendben írja ki, az RFC 8785 viszont UTF-16
sorrendet ír elő, ahol a `"10"` megelőzi a `"9"` kulcsot (F-26). A `startRun` ezért **nyers `sql`
sablonnal** ír be (`import { sql } from 'drizzle-orm'`, `database.run(sql\`INSERT INTO
graph_snapshot ...\`)`), ami a kanonikus szöveget változtatás nélkül köti a paraméterbe, és
ugyanígy **nyers `sql` SELECT-tel** olvassa vissza az ütközés-ellenőrzéshez (`resolveSnapshotReuse`bájtra pontos szöveg-összehasonlítást igényel, nem parsolt objektumot). A`workflow-run-repository.spec.ts` "a beszúrt document oszlop bájtra a kanonikus szöveg" tesztje
egy egész indexű kulcsokat tartalmazó fixture-rel (`documentWithIntegerLikeKeys`) igazolja ezt,
és külön asszerciót tesz arra, hogy a naiv `JSON.parse`+`JSON.stringify` kör **más** szöveget
adna - ez bizonyítja, hogy a teszt nem üres, és hogy a hiba valóban létezne a nyers SQL nélkül.

**Drizzle típusdefiníciós pontatlanság: a `.get<T>()` és a `.returning().get()` deklarált típusa
nem tartalmaz `undefined`-et.** A `BaseSQLiteDatabase.get<T = unknown>(query): DBResult<'sync', T>`
`sync` módban pontosan `T`-re oldódik fel (`drizzle-orm/sqlite-core/session.d.ts`,
`DBResult<TKind, TResult> = { sync: TResult; ... }[TKind]`), holott a mögöttes `better-sqlite3`
`stmt.get()` ténylegesen `undefined`-et ad nulla találatra
(`drizzle-orm/better-sqlite3/session.js`, `PreparedQuery.get`). Ez Drizzle 0.45.2 saját
típusdefiníciójának a pontatlansága, nem a mi kódunké (hasonló jellegű, mint a `CLAUDE.md`
"Függőségi irány" szakasz `skipLibCheck` bejegyzése). A `readStoredCanonicalText` és a
`transitionRun` ezért `row === undefined` ellenőrzést végez egy olyan típuson, amit a fordító
sosem `undefined`-nek jelez: az `@typescript-eslint/no-unnecessary-condition` és a
`sonarjs/different-types-comparison` szabály ezt jogosan flagelné tévesen, ezért mindkét helyen
`eslint-disable-next-line` áll, részletes indoklással a forráskódban.

**A compare-and-set egyetlen forrásból (`canTransitionRunStatus`) vezeti le a `WHERE status IN
(...)` feltételt.** A `transitionRun` belső segédfüggvény `allowedFromStatuses(to)` a hat
`RunStatus` értéket végigszűri `canTransitionRunStatus(from, to)`-val, tehát a 7.1 táblázat
átmeneti szabálya és a compare-and-set `UPDATE` sosem futhat szét egymástól (nincs két, kézzel
karbantartott lista). A `RETURNING` záradék (`drizzle-kit`/`better-sqlite3` SQLite 3.35+
támogatás) egy kérésben adja vissza a frissített sort, tehát a hívás nem igényel külön
újraolvasást az `UPDATE` után.

**`readSnapshot`-nak van egy `not_found` ága a hiányzó pillanatkép sorra**, ami a bekapcsolt
`ON DELETE RESTRICT` (F-27) miatt rendes úton megnyitott kapcsolaton sosem fordulhat elő; a
tesztje egy explicit `foreign_keys = OFF` pragmával nyitott kapcsolaton szimulálja a megsérült
(dangling) állapotot. **Fontos mérési megjegyzés:** a `better-sqlite3` 13.0.3 saját mérésünk
szerint **bekapcsolt** `foreign_keys` pragmával nyit alapból (nem az F-1 által hivatkozott, a
puszta SQLite könyvtárra vonatkozó, kikapcsolt alapértelmezéssel) - a teszteknek ezért az "FK
nélküli" ághoz **explicit ki kell kapcsolniuk** a pragmát, nem elég kihagyni a bekapcsolást.

**Nincs exportált művelet, ami pillanatkép nélküli futást hozna létre.** A `startRun` az egyetlen
függvény, ami `.insert(workflowRunTable)`-t hív ebben a fájlban, és a fájl az egyetlen hely a
csomagban, ahol ez a hívás előfordul (a `workflow-repository.ts` csak `select`/`delete`-et végez
a táblán, a `DELETE FROM graph_snapshot ...` söprésen kívül, ami nem érinti a `workflow_run`
táblát).

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
