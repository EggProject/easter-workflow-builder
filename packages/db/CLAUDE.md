# packages/db

## Mi ez a mappa

Drizzle séma, migrációk, repository-k (SPEC-003). A csomag téma mappánként épül fel; ez a fájl
a végrehajtás alatt folyamatosan bővül, ahogy egy-egy téma mappa elkészül. A barrel
(`src/index.ts`) a `sqlite-connection` téma óta valódi exportot ad, a korábbi placeholder
(`IS_DB_PLACEHOLDER`) megszűnt (SPEC-002 6.6 6. szabálya, T-003-9).

## Fájlok

| Mappa                     | Tartalom                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `database-file/`          | az adatbázis fájl helyének feloldása: `EASTER_DB_FILE` env változó neve, fejlesztői alapértelmezés, könyvtár létrehozása (SPEC-003 10.1 szekció)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `sqlite-connection/`      | `openDatabase`, a `DatabaseContext` felület mind a nyolc repository mezővel (`workflows`, `runs`, `stepRuns`, `events`, `approvals`, `settings`, `concurrencyLimits`, `recovery`), a pragma sorrend, a migráció bekötése (SPEC-003 10.2 szekció), a tranzakció és a zárás; plusz a `barrel-exports.spec.ts`, a barrel exportlistájának gépi ellenőrzése (T-003-27, lásd lent)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `migration/`              | a migrációs mappa útvonala (`MIGRATIONS_FOLDER`) és a `migrate()` hívás `Outcome` hibaágra burkolása; nem barrel export, `openDatabase` belső részlete                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `workflow-graph/`         | `workflow`, `workflow_node`, `workflow_edge` tábla (SPEC-003 4.1, 4.2, 4.7 szekció); a `NodeType` unió, a node config unió, az `AgentStepConfig` és a typeguardjaik (T-003-11); a `WorkflowRepository` (T-003-12)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `graph-snapshot/`         | a pillanatkép dokumentum típusa és verzió uniója, a `GRAPH_DOCUMENT_VERSION`, az RFC 8785 kanonizáló, a `sha256` lenyomat képzés, a `resolveSnapshotReuse` döntő függvény, a verziódiszpécser `readGraphSnapshot` és a typeguardok (SPEC-003 5. szekció, T-003-14); a `graph_snapshot` tábla (`hash` elsődleges kulcs, `graph_snapshot_version_idx` index, nincs idegen kulcsa) és a `graph_snapshot_no_update` `BEFORE UPDATE` trigger, ami minden módosítási kísérletet `SQLITE_CONSTRAINT_TRIGGER` hibával buktat meg (SPEC-003 4.9 és 5.5 szekció, T-003-15)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `workflow-run/`           | a `workflow_run` tábla (SPEC-003 4.8 szekció): önhivatkozó `root_run_id` (`ON DELETE CASCADE`) és `restarted_from_run_id` (`ON DELETE SET NULL`) idegen kulcs, `graph_snapshot_hash` idegen kulcs `ON DELETE RESTRICT` viselkedéssel a `graph_snapshot` táblára (F-27, F-28, 51. kritérium), négy index; a `RunStatus` hat állapota és a `canTransitionRunStatus` átmeneti szabály függvény, kimerítő `switch` szerkezettel (SPEC-003 7.1 és 7.3 szekció, T-003-13); a `WorkflowRunRepository`: `startRun` (az egyetlen beszúrási út, a pillanatkép feloldásával, a globális `persist_stream_deltas` befagyasztásával ÉS a `run_started` motor esemény írásával, mind ugyanabban a tranzakcióban, T-003-16, T-003-23, T-003-21), `getRun`/`listRuns`/`listRunsForWorkflow`, a négy compare-and-set állapotváltó és `readSnapshot` (T-003-16)                                                                                                                                                                                                                                                                                                                                      |
| `step-run/`               | a `step_run` tábla (SPEC-003 4.10 szekció): `run_id` idegen kulcs `ON DELETE CASCADE` a `workflow_run` táblára, önhivatkozó `parent_step_run_id` (a végrehajtási fa, `ON DELETE CASCADE`), `sub_workflow_run_id` idegen kulcs `ON DELETE SET NULL` a `workflow_run` táblára, négy index; a `node_id` szándékosan **nem** idegen kulcs a `workflow_node` táblára (21. kritérium); nincs egyediségi megszorítás a `(run_id, node_id, iteration, attempt)` négyesen; az `iteration`/`attempt`/`forked_session` séma szintű `.default()` technikai alapértéket kap (0/1/hamis). A `StepRunStatus` nyolc állapota és a `canTransitionStepRunStatus` átmeneti szabály függvény, kimerítő `switch` szerkezettel (SPEC-003 7.2 és 7.3 szekció, T-003-17). A `StepRunRepository`: `createStepRun`, `listStepRuns`, `getStepRun`, a hat nevesített compare-and-set állapotváltó (`markStepRunning`, `markStepWaitingApproval`, `markStepSucceeded`, `markStepFailed`, `markStepRejected`, `markStepCancelled`) és `attachSession` (T-003-18)                                                                                                                                                |
| `app-setting/`            | az `app_setting` tábla (SPEC-003 4.13 szekció): egysoros tábla, `CHECK (id = 1)` (F-15), a `persist_stream_deltas` oszlop séma szintű `.default(false)` alapértékkel (F-28, a 6. user döntés); a migráció egyetlen sort sem szúr be (41. kritérium). Az `AppSettingRepository`: `readSettings` (üres táblán `defaultProviderId: null`, `persistStreamDeltas: false`), `setDefaultProvider` és `setPersistStreamDeltas` (mindkettő `INSERT ... ON CONFLICT(id) DO UPDATE` upsert, a nem érintett oszlop a séma szintű alapértékét kapja beszúráskor, 56. kritérium, T-003-23)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `provider-concurrency/`   | a `provider_concurrency_limit` tábla (SPEC-003 4.14 és 11. szekció): `provider_id` elsődleges kulcs, `CHECK (max_concurrent_steps > 0)` (F-15); a migráció üresen indul, sem a kódban, sem a migrációban nincs szállított párhuzamossági alapérték (41. kritérium). A `ProviderConcurrencyRepository`: `readLimit`, `readAllLimits`, `setLimit` (upsert, a `CHECK` megsértését a `better-sqlite3` `SQLITE_CONSTRAINT_CHECK` hibájának elkapásával `invalid_max_concurrent_steps` `Outcome` hibaágra fordítja, nem duplikálja a `> 0` szabályt TypeScript oldalon) és `clearLimit` (nem hiba, ha a sor nem is létezett, T-003-23)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `run-event/event-record/` | a `run_event` tábla (SPEC-003 6.2 szekció): `id` `INTEGER PRIMARY KEY AUTOINCREMENT` (F-9, F-13, 9. kritérium, NEM sima `INTEGER PRIMARY KEY`), `run_id` idegen kulcs `ON DELETE CASCADE` a `workflow_run` táblára, opcionális `step_run_id` idegen kulcs `ON DELETE CASCADE` a `step_run` táblára (futás szintű eseménynél NULL), három index (`run_event_run_id_idx`, `run_event_step_run_id_idx`, `run_event_run_uuid_uq` **egyedi** a `(run_id, sdk_uuid)` páron, F-10: több NULL `sdk_uuid` sor is beszúrható ugyanahhoz a `run_id`-hez). A `kind` oszlopon **nincs** `CHECK` constraint (6.4 szekció). A `RunEventRepository`: `appendSdkEvent` (a delta kapcsolót megkerülhetetlenül érvényesítő, egyetlen `INSERT ... SELECT` utasítás, `written`/`skipped` eredménnyel, `duplicate_event` hibaággal), `appendEngineEvent`, `readEventsSince` (kötelező `limit`), `readEventsForStep` és `aggregateRunTokens` (T-003-21); a `RunEventKind`/`isRunEventKind` innentől a barrelben is szerepel. Az `insert-engine-event-row.ts` a tranzakció nélküli beszúró segéd, kizárólag ehhez a táblához; az `extract-error-cause.ts` a beszúrási hibaág segédje.                     |
| `run-event/event-kind/`   | a huszonöt értékű `RunEventKind` unió (`run-event-kind.ts`) és az `isRunEventKind` guard (`is-run-event-kind.ts`); egyik sem kerül a barrelbe önállóan, a `RunEventRepository` dönt az exportról (T-003-21).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `run-event/sdk-message/`  | a nyers SDK üzenet normalizálása: `normalize-sdk-message.ts` (`normalizeSdkMessage`) és a hozzá tartozó `is-sdk-message-envelope.ts` boríték guard (T-003-20, lásd lent).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `human-approval/`         | a `human_approval` tábla (SPEC-003 4.12 szekció): `run_id` idegen kulcs `ON DELETE CASCADE` a `workflow_run` táblára, `step_run_id` idegen kulcs `ON DELETE CASCADE` a `step_run` táblára, két index (`human_approval_step_uq` **egyedi** a `(step_run_id)` oszlopon, `human_approval_pending_idx` a `(decision, requested_at_ms)` páron, F-10: SQLite az indexben tárolja a NULL `decision` értéket is). Az `ApprovalDecision` unió (`'approved' \| 'rejected'`) és az `isApprovalDecision` guard a barrelben is szerepel. A `HumanApprovalRepository`: `requestApproval` (beszúrja a sort `decision: null` értékkel, ÉS ugyanabban a tranzakcióban `running -> waiting_approval` állapotba viszi a lépés futást a `StepRunRepository.markStepWaitingApproval` hívásával), `decideApproval` (compare-and-set `UPDATE ... WHERE step_run_id = ? AND decision IS NULL`, majd `markStepSucceeded`/`markStepRejected`, ugyanabban a tranzakcióban - ha az állapotváltás hibázik, a döntés írása is visszagördül), `getApprovalForStep` és `listPendingApprovals` (`WHERE decision IS NULL ORDER BY requested_at_ms`, a `human_approval_pending_idx` indexből kiszolgálva, T-003-22). |
| `run-recovery/`           | **nincs saját tábla**: a szerver indulási helyreállítása (SPEC-003 7.4 szekció, "Szerver leállás"), ami a `workflow_run` ÉS a `step_run` táblát EGYÜTT érinti, ezért egyik témába sem tartozik (8. szekció). A `RunRecovery.recoverInterruptedRuns()` egyetlen tranzakcióban: minden `pending`/`running` futás `interrupted` állapotba, a hozzájuk tartozó minden nem terminális (`pending`/`running`/`waiting_approval`) lépés futás szintén, majd futásonként EGY `run_interrupted` motor esemény (`origin: 'engine'`, `stepRunId: null`) - tömeges `UPDATE ... WHERE status IN (...) RETURNING id` alakban, NEM a `markRunInterrupted`/`markStepInterrupted` egyenkénti hívásával iterálva (lásd lent, T-003-24). A `DatabaseContext.recovery` mező adja, ez az utolsó mező, amivel mind a 12 téma mappa elkészült. Az `openDatabase` **nem** hívja automatikusan: a `packages/db` csak a képességet adja, a hívás az `apps/server` felelőssége lesz egy KÉSŐBBI specifikációban, a szerver indulásakor, hálózati kapcsolat fogadása előtt.                                                                                                                                    |

A `drizzle.config.ts` a csomag gyökerén áll, a `drizzle/` mappa a generált, gitbe commitolt SQL
migrációkat és a hozzájuk tartozó snapshotot tartalmazza. A `schema` mező explicit fájllista,
nem glob: a `.spec.ts` fájlok `vitest` importja miatt a drizzle-kit esbuild alapú CJS bundlere
elhasalna egy `./src/**/*.ts` mintán, a hivatalos config doksi pedig nem dokumentál negációs
glob mintát erre a mezőre. Új tábla fájlt ezért a `drizzle.config.ts` listájába is fel kell
venni. A `run-recovery` témának nincs saját tábla fájlja, ezért a `drizzle.config.ts` listáját
nem érinti.

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
  túlélő, más workflow-hoz tartozó futás is mutat, nem számít bele. **Az `eventCount` a T-003-27
  óta szintén pontos darabszám** (a korábbi, kényszerű `0` és a hozzá tartozó "NYITOTT PONT"
  komment megszűnt): `SELECT COUNT(*) FROM run_event WHERE run_id IN (deletedRunIds)`, Drizzle
  `count()` aggregáttal. Kaszkád-számítás itt nem kell, ellentétben a `snapshotCount`-tal: a
  `run_event.run_id` idegen kulcs `ON DELETE CASCADE` a `workflow_run` táblára, a `run_event` a
  futás gyereke (nem a szülője), és egy sort nem oszthat meg két futás, mert a `run_id`
  egyértékű. A `step_run_id` szerinti második út sem hoz be új sort, mert a `step_run` maga is
  `ON DELETE CASCADE` a `workflow_run` táblára. Üres `deletedRunIds` halmazra a Drizzle
  `inArray` `false` feltételt generál (`drizzle-orm@0.45.2`,
  `sql/expressions/conditions.js`, forrásból ellenőrizve), tehát nincs szükség külön ágra, és a
  `GROUP BY` nélküli aggregát SQLite-ban ilyenkor is pontosan egy sort ad - ugyanaz az eset,
  mint a `RunEventRepository.aggregateRunTokens`-nél, tehát itt sincs `undefined` ellenőrzés és
  `eslint-disable`.
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

**NYITOTT PONT: a `no_default_provider` hibaosztály (40. kritérium fele) elérhetetlen a `db`
rétegben, ez SZÁNDÉKOSAN nincs javítva (T-003-28 átvizsgálás).** A `StartRunInput.providerId`
kötelező, már feloldott `ProviderId` - a fenti bekezdés szerint ez a motor felelőssége, nem a
`startRun`-é. A `startRun` emiatt sosem kerül abba a helyzetbe, hogy az `app_setting.
default_provider_id`-ből kellene kitöltenie egy üres mezőt, tehát a 4.13 szekcióban leírt
`no_default_provider` hibaág a mai kódban logikailag elérhetetlen, előidézhetetlen teszttel.

- **Mi a viselkedés addig.** Ha a hívó (a motor, egy KÉSŐBBI specifikációban) nem tud
  feloldani egy providert, a döntés az ő felelőssége marad: vagy maga olvassa ki az
  `AppSettingRepository.readSettings()` `defaultProviderId` mezőjét és NULL esetén állítja
  meg a folyamatot a hívó oldalán, vagy egy jövőbeli `startRun` bemeneti alak bővítés adja át
  ezt a döntést a `db` rétegnek.
- **Mi zárná le.** Egy architekturális döntés arról, hogy a `startRun` maga oldjon-e fel egy
  hiányzó `providerId`-t az `app_setting` táblából, vagy ez a motor felelőssége marad - ez a
  `StartRunInput` alakját érintené, tehát redesign, nem mechanikus javítás, ezért a T-003-28
  ezt NEM hajtja végre magától, hanem user döntést igényel.

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

## A `StepRunRepository` (T-003-18)

A `step-run-repository.ts` a `createStepRun`, `listStepRuns`, `getStepRun`, a hat nevesített
compare-and-set állapotváltó (`markStepRunning`, `markStepWaitingApproval`, `markStepSucceeded`,
`markStepFailed`, `markStepRejected`, `markStepCancelled`) és `attachSession` műveletet adja,
`openDatabase` köti be a `DatabaseContext.stepRuns` mezőbe, ugyanazzal a `transaction()`
függvénnyel, amit a `workflows` és a `runs` mező is használ. A barrel csak a `StepRunRepository`,
`CreateStepRunInput`, `StepRunTokenUsage`, `MarkStepSucceededInput`, `MarkStepFailedInput`,
`AttachSessionInput` és `StepRunRecord` típust exportálja, a `createStepRunRepository` factory
függvényt nem (SPEC-002 6.6 5. szabálya, SPEC-003 9.3 szekció). Nincs általános `updateStatus`
metódus (24. kritérium).

**A `missing_structured_output` döntés: repository szintű, defenzív ellenőrzés.** A SPEC-003 7.2
szekció szó szerint kimondja: "Strukturált kimenetet váró lépés csak akkor lép `succeeded`
állapotba, ha a `subtype` `success`, és a kimenet ténylegesen megvan és sémára illeszkedik.
Különben `failed`, `missing_structured_output` hibaosztállyal." Ez két réteget érint: a motor
dönti el, hogy egyáltalán `markStepSucceeded`-et hív-e (az SDK `result` üzenet `subtype` és
`structured_output` mezője alapján, ez a `db` csomagon kívüli felelősség, a research 5.2
szekciója szerint), de a `markStepSucceeded` hívás önmagában **nem bízik** ebben a döntésben:
ha a lépés futás tárolt `structured_output_strategy` oszlopa nem NULL (tehát a lépés
strukturált kimenetet vár), és a hívó `output` nélkül (`undefined`) hívja a függvényt, a hívás
`missing_structured_output` `Outcome` hibaágat ad, és a sor **nem** kerül `succeeded` állapotba

- sem a `status`, sem semelyik más oszlopa nem változik. Az ellenőrzés egy `SELECT`-tel történik
  az `UPDATE` előtt, ugyanabban a tranzakcióban, hogy a döntés a jelenleg tárolt
  `structured_output_strategy` értéken alapuljon, ne a hívó állításán. Ez a védelem a repository
  réteg saját, a nevesített átmeneti szabályon (`canTransitionStepRunStatus`) **felül** álló
  üzleti szabálya, nem szerepel a SPEC-003 12.4 szekció tíz kötelező hibaosztályának listáján
  (az a lista a `db` csomag korábbi, e döntés előtti állapotát rögzíti), de a `.spec.ts` valós
  teszttel idézi elő, és a 100 százalékos lefedettségi küszöb ettől függetlenül megköveteli.

**A token oszlopok egyszeri írása.** A `markStepSucceeded` és a `markStepFailed` opcionális
`tokens?: StepRunTokenUsage` mezőt fogad (a hívó az SDK `result` üzenetből olvassa ki), amit a
`tokenColumns` segédfüggvény ugyanabba az `UPDATE`-be tolja bele, mint a `status` és a
`finished_at_ms` módosítás - egyetlen írási út, egyetlen tranzakció. Mivel mindkét célállapot
(`succeeded`, `failed`) terminális, a `canTransitionStepRunStatus` szerint nincs belőlük kimenő
átmenet, tehát egy második `markStepSucceeded`/`markStepFailed` hívás ugyanarra a sorra a
compare-and-set `WHERE status IN (...)` feltételen bukik el, `illegal_status_transition`
hibaággal, az `UPDATE` nulla sort módosít, és a token oszlopok érintetlenek maradnak - nincs
külön védelem erre, a terminális állapot ténye önmagában elég.

**A bemeneti típusok nullázhatósági konvenciója eltér a `WorkflowRunRepository`-étől.** A
`CreateStepRunInput` `parentStepRunId`, `modelId`, `sessionMode`, `structuredOutputStrategy` és
`subWorkflowRunId` mezője **kötelezően kitöltött, nullázható** (`T | null`), a
`workflow-graph/workflow-repository.ts` `CreateWorkflowInput`-jának mintáját követve
(`description`, `providerId`: a hívó explicit `null`-t ad, nem hagyja ki a mezőt), NEM a
`workflow-run-repository.ts` `StartRunInput.restartedFromRunId?: string` mintáját (opcionális,
belső `?? null` átalakítással). A döntés oka: így a repository kódjában sehol nem keletkezik
`null` literál a bemenet feldolgozásakor (nincs `?? null`), csak a hívótól kapott érték megy
tovább változtatás nélkül, ezért nincs szükség `unicorn/no-null` `eslint-disable`-re a bemenet
feldolgozásánál - csak a `createStepRun` végén, a frissen létrehozott sor még kitöltetlen
mezőinek (pl. `sdkSessionId`, `output`) explicit kezdő `null` értékénél, ugyanúgy, ahogy a
`workflow-run-repository.ts` `startRun`-ja is egy `eslint-disable`/`enable` blokkba zárja a saját
kezdő `null` mezőit. Az `iteration` és `attempt` ezzel szemben **opcionális, alapértékkel**
(`?:`, `?? 0` / `?? 1`): ez technikai kezdőérték, nem nullázhatóság, tehát nem esik ez alá a
szabály.

**Miért nincs `isSessionMode` vagy `isStructuredOutputStrategyId` guard a `toStepRunRecord`-ban.**
A SPEC-003 9.4 szekció a domain guardok listáját **explicit, kimerítő** felsorolással adja meg:
`isNodeType`, `isNodeConfig`, `isAgentStepConfig`, `isRunStatus`, `isStepRunStatus`,
`isRunEventKind`, `isApprovalDecision`, `isProviderId`, `isGraphSnapshotDocumentV1`,
`isGraphSnapshotHash`. A `toStepRunRecord` ebből kettőt használ ténylegesen a `step_run` sorra:
`isProviderId`-t (`provider_id` oszlop) és `isStepRunStatus`-t (`status` oszlop), a
`WorkflowRunRecord` mintáját követve. A `session_mode`, a `structured_output_strategy` és a
`node_type` oszlop ezzel szemben `string | null` (illetve `node_type` esetén `string`) marad a
`StepRunRecord`-ban, a nyers Drizzle oszloptípusnak megfelelően, **új guard bevezetése nélkül**:
egyik értékét sem használja elágazó üzleti logika a repositoryban (a `markStepSucceeded` csak azt
nézi, `structuredOutputStrategy !== null`, a konkrét értéket nem), és a `NodeType`-hoz meglévő
`isNodeType` guard eddig kizárólag JSON-ba ágyazott `type` mezőt szűkített (`is-node-config.ts`,
`is-graph-snapshot-document-v1.ts`), nem önálló, nyers `text` oszlopot - a `step_run.node_type`
oszlop pedig a pillanatképből már ellenőrzött értéket másolja ki (4.10 szekció), tehát nincs új
korrupciós felület, amit itt kellene elkapni. Ha egy jövőbeli lépés ezekhez az oszlopokhoz
elágazó logikát rendel, a guard bevezetése és a 9.4 lista bővítése együtt jár.

## Az `AppSettingRepository` és a `ProviderConcurrencyRepository` (T-003-23)

Az `app-setting-repository.ts` a `readSettings`, `setDefaultProvider` és `setPersistStreamDeltas`
műveletet adja, a `provider-concurrency-repository.ts` a `readLimit`, `readAllLimits`, `setLimit`
és `clearLimit` műveletet, mindkettő `openDatabase` köti be a `DatabaseContext.settings`, illetve
`.concurrencyLimits` mezőbe. A barrel csak a két repository típust és a bemeneti/kimeneti
típusaikat exportálja (`AppSettingRepository`, `AppSettingsRecord`, `ProviderConcurrencyRepository`),
a két factory függvényt nem (SPEC-002 6.6 5. szabálya, SPEC-003 9.3 szekció).

**Az upsert mintája mindkét repositoryban azonos.** `INSERT ... VALUES (...) ON CONFLICT(...) DO
UPDATE SET ...` (Drizzle `.onConflictDoUpdate({ target, set })`), ahol a `.values()`-ból
szándékosan **kimarad** minden oszlop, aminek a beszúráskori értékét a hívó nem adta meg: ha ez a
hívás hozza létre a sort először, SQLite a séma szintű `DEFAULT`-tal tölti ki (`persist_stream_deltas`
`.default(false)`, F-28) vagy NULL-lal (`default_provider_id`, aminek nincs alapértéke), sosem egy a
repositoryban kitalált értékkel. A `set` ág csak a hívó által ténylegesen megadott oszlopot
frissíti, a másik érintetlen marad - ez adja a SPEC-003 4.13 szekció "A sor életciklusa" bekezdés
mindhárom ágát (nincs sor, `setDefaultProvider` hoz létre elsőként, `setPersistStreamDeltas` hoz
létre elsőként), mindhárom tesztelve (`app-setting-repository.spec.ts`, 56. kritérium).

**A `provider_concurrency_limit.max_concurrent_steps > 0` szabály nem duplikált TypeScript
oldalon.** A bemeneti `maxConcurrentSteps: number` típus elvben 0-t vagy negatív számot is
hordozhat; a döntés a `CHECK` constraintra (4.14 szekció, F-15) bízza az érvényesítést: a
`setLimit` elkapja a `better-sqlite3` `SqliteError`-ját, ha annak `code` mezője
`SQLITE_CONSTRAINT_CHECK`, és `invalid_max_concurrent_steps` `Outcome` hibaágra fordítja
(`provider-concurrency-repository.ts`, `setLimit` dokumentációja). Minden más hibakódot
továbbenged (`throw error`), ezt a `transaction` wrapper (`open-database.ts`) alakítja `Outcome`
hibaággá, ugyanúgy, mint bármelyik másik váratlan adatbázis hibát. Az indok: a `CHECK` az
egyetlen igazságforrás a `> 0` szabályra, tehát a repository nem tarthat fenn egy második,
kézzel karbantartott másolatot, ami elvben szétfuthatna a sématól.

**`readAllLimits` és `readSettings` az `isProviderId` guardot alkalmazza olvasáskor** (SPEC-003
9.4 szekció), ugyanaz a minta, mint a `WorkflowRunRepository.toWorkflowRunRecord`-ban: egyik
oszlopon (`provider_id`, `default_provider_id`) sincs DB szintű `CHECK` a felsorolt provider
azonosítókkal, ezért egy korrupt sor `invalid_provider_id` hibaágat ad, nem csendes hibás kulcsot.

## Az `app_setting.persist_stream_deltas` befagyasztása a `startRun`-ban (T-003-23)

A `workflow-run-repository.ts` `startRun`-ja a korábbi, szállított `false` konstans helyett a
`isPersistStreamDeltasEnabled` belső segédfüggvénnyel, **ugyanabban a tranzakcióban** olvassa ki
a globális beállítást, és ezt írja a `workflow_run.persisted_stream_deltas` oszlopba (SPEC-003 6.6
szekció, "Futás közben nem változhat", 38. és 57. kritérium). A segédfüggvény **nem** az
`AppSettingRepository.readSettings()`-et hívja: az egy saját, önálló `transaction()`-t indítana
ugyanazon a `better-sqlite3` kapcsolaton, amíg a `startRun` tranzakciója már fut - ehelyett
közvetlen, típusos `select` az `app_setting` táblára, ugyanaz az elv, mint ahogy a
`workflow-run-repository.ts` már korábban is közvetlenül olvasta a `graph_snapshot` táblát a
`readStoredCanonicalText`-ben, más témák repositoryján keresztül menve helyett. A kritikus teszt
(`workflow-run-repository.spec.ts`) egy futást indít a séma szintű hamis alapérték mellett, utána
közvetlenül upsertel az `app_setting` táblára `persistStreamDeltas: true` értékkel, majd egy
második futást indít: az első futás `getRun`-nal visszaolvasott értéke változatlanul hamis marad,
a második igaz - ez igazolja, hogy a globális beállítás későbbi átállítása a már elindult futást
nem érinti.

## Az SDK üzenet normalizálása (T-003-20)

A `run-event/sdk-message/normalize-sdk-message.ts` egyetlen exportált függvénye a
`normalizeSdkMessage(message: unknown): Outcome<NormalizedSdkMessage>`, mellette az
`is-sdk-message-envelope.ts` `isSdkMessageEnvelope` boríték guardja áll. **Ez a lépés tisztán
normalizáló logika: nincs benne adatbázis írás, és egyik fájl sem kerül a barrelbe** (a
`RunEventRepository` fogja használni belső, relatív importtal, T-003-21). Motor eredetű
(`origin = 'engine'`) esemény nem megy át rajta: annak nincs nyers SDK üzenete, csak `payload`-ja.

**A `type`/`subtype` leképezése a tizenkét `sdk` eredetű `kind` értékre.** A forrás a pinelt
`@anthropic-ai/claude-agent-sdk@0.3.245` saját típusdefiníciója, a
[`../../docs/research/2026-08-26-agent-sdk-minimax.md`](../../docs/research/2026-08-26-agent-sdk-minimax.md)

1. szekció "Az `SDKMessage` ágak drótalakja" táblázatába vezetve, forrás URL-lel (11. kritérium).
   A lényeg: az öt observability üzenet `type` mezője **`system`**, nem saját top-level típus, tehát
   őket kizárólag a `subtype` (`hook_started`, `hook_progress`, `hook_response`, `informational`,
   `commands_changed`) különbözteti meg a `system` `init` üzenettől; az `SDKRateLimitEvent` viszont
   saját top-level `type` értéket visel (`rate_limit_event`). Minden más `system` subtype (`init`,
   `status`, `thinking_tokens`, `compact_boundary`, ...) a gyűjtő `sdk_system` értéket kapja. A 6.4
   lista **zárt**: ismeretlen `type` esetén a függvény `unrecognized_sdk_message_type` `Outcome`
   hibaágat ad, nem talál ki csendben egy "ismeretlen" `kind` értéket.

**NYITOTT PONT: a `sdk_context_usage` `kind` értékre ebben az SDK verzióban nincs leképezés.** A
6.4 szekció huszonöt értékű listája a research 1. szekció felsorolásából származik, ami az
`SDKContextUsage` típust az observability üzenetek közé sorolja. A pinelt 0.3.245 csomag
típusdefiníciója szerint viszont az `SDKContextUsage` **nem** `SDKMessage` ág, hanem az
`SDKAssistantMessage.context_usage` opcionális mezőjének az alakja, és `context_usage` értékű
`type` vagy `subtype` a csomagban nem létezik. A normalizáló ezért a context usage adatot hordozó
üzenetre `sdk_assistant` értéket ad, a `sdk_context_usage` érték pedig a `RunEventKind` unióban
marad, de nem keletkezik. Kitalált leképezést nem adunk hozzá; ezt egy jövőbeli SDK verzió
(vagy a 6.4 lista felülvizsgálata) zárja le.

**Következmény az 58. kritériumra (T-003-28 átvizsgálás).** A SPEC-003 15. szekció 58.
kritériuma szó szerint "a másik tizenegy `sdk` eredetű `kind`" kifejezést használja a
`sdk_stream_event`-en kívüli sorokra. A fenti okból ebből csak TÍZ idézhető elő ténylegesen a
`normalizeSdkMessage`-en át - a `sdk_context_usage` a tizenegyedik, ami nem termelhető ki
kitalált nyers üzenettel, mert az meghamisítaná a bizonyítékot. A `run-event-repository.spec.ts`
"a delta kapcsoló kikapcsolt állapotban minden nem-sdk_stream_event kind sorát megírja (58.
kritérium)" `describe` blokkja ezt a tíz kind-ot egy `it.each` paraméterezett teszttel fedi
(ugyanazokkal a nyers üzenet mintákkal, mint a `normalize-sdk-message.spec.ts`), plusz mind a
13 `engine` eredetű kind-ot egy második `it.each`-csel - a hiányzó tizenegyedik esetet egy külön
`it('pontosan tíz nem-sdk_stream_event sdk eredetű kind tesztelhető ténylegesen ...')` teszt
dokumentálja, számként rögzítve, nem hallgatva el.

**Minden normalizált mező nullable, hiányzó mező NULL-t ad** (6.2 szekció, 10. kritérium). Nincs
`?? 0` és nincs `?? ''` alapérték, ami hiányzó adatot valós adatnak álcázna. Az **üres szöveg is
NULL**, nem üres szöveg: az `sdk_uuid` oszlopon a `run_event_run_uuid_uq` egyedi index fut, ahol
két üres szöveg ütközne, két NULL viszont nem (F-10). A `sdk_message_subtype` kizárólag `system`
és `result` üzenetből töltődik, a `num_turns` kizárólag `result` üzenetből.

**A négy `usage` oszlop forrása engedélyező lista, nem tiltás** (6.2 szekció, 61. kritérium). A
`readUsageSource` belső segédfüggvény pontosan két ágnak ad forrást: a `sdk_result` sor a
top-level `usage` mezőből, a `sdk_assistant` sor a beágyazott Anthropic `Message` objektum
`message.usage` mezőjéből tölt; minden más `kind` NULL-t kap. Az `sdk_stream_event` sor tehát
akkor sem tölt egyetlen usage oszlopot sem, ha a nyers üzenet top-level `usage`, `message.usage`
és `event.usage` mezőt is hordoz. Ezt a `normalize-sdk-message.spec.ts` pontosan ilyen,
adverzariális bemenettel teszteli.

**Költség oszlop nincs.** A `result.total_cost_usd` a nyers `payload` JSON-ban marad (6.2
szekció); a teszt a `NormalizedSdkMessage` kulcskészletét tételesen assertálja, tehát egy
jövőbeli, észrevétlen költségoszlop bevezetése megbuktatja.

**A `tool_name`/`tool_use_id` egyértékű, a `content` viszont tömb.** Az oszlopokba az asszisztens
üzenet `message.content` tömbjének **első**, a mezőire nézve is érvényes `tool_use` blokkja kerül
(`id` és `name`), a többi a `payload`-ban marad. Ez a 6.2 mezőkészlet következménye, nem választás:
a séma nem ad ismétlődő oszlopot. A blokk alakjának forrása
`https://unpkg.com/@anthropic-ai/sdk@0.120.0/resources/beta/messages/messages.d.ts`
(`BetaToolUseBlock`), megerősítve a hivatalos tool use és streaming doksival; a hivatkozások a
research fájl fenti szekciójában állnak.

## A `RunEventRepository` és a delta kapcsoló megkerülhetetlen érvényesítése (T-003-21)

A `run-event-repository.ts` az `appendSdkEvent`, `appendEngineEvent`, `readEventsSince`,
`readEventsForStep` és `aggregateRunTokens` műveletet adja, `openDatabase` köti be a
`DatabaseContext.events` mezőbe, ugyanazzal a `transaction()` függvénnyel, amit a többi
repository is használ. A barrel a `RunEventRepository` típust és a bemeneti/kimeneti típusait
exportálja, a `createRunEventRepository` factory függvényt nem (SPEC-002 6.6 5. szabálya,
SPEC-003 9.3 szekció) - ez az a lépés, ahol a `RunEventKind`/`isRunEventKind` is végre kikerül a
barrelbe (eddig csak a téma mappán belül élt, T-003-19).

**A delta kapcsoló nyers SQL-lel érvényesül, nem Drizzle `insert().select()` alakban.** A
Drizzle 0.45.2 SQLite query buildere ismeri az `INSERT ... SELECT` mintát
(`SQLiteInsertBuilder.select()`, `drizzle-orm/sqlite-core/query-builders/insert.d.ts`), de a
projekció ebben az esetben csupa **konstans** érték lenne (a hívó paraméterei), nem a forrás
tábla oszlopai - ez a Drizzle select-buildernél oszloponkénti `sql`-becsomagolást és a beszúrt
tábla mezőneveivel pontosan egyező aliasolást igényelne, ami ugyanannyi (vagy több) kézzel írt
SQL-fragmentum, típusbiztonság nyeresége nélkül. A nyers `sql` sablon (`database.run(sql\`INSERT
INTO run_event (...) SELECT ... FROM workflow_run WHERE id = ... AND (...)\`)`) ezzel szemben
szó szerint a SPEC-003 6.6 szekció pszeudokódja, és ugyanaz a minta, mint amit a
`workflow-run-repository.ts` `startRun`-ja már bevezetett a `graph_snapshot`beszúrásnál (a
Drizzle JSON`mapToDriverValue` megkerülésére) - egyetlen technika a csomagban a "konstans
értékeket egy feltételes forrás táblából eredő WHERE mögé" mintára.

**Az `appendSdkEvent` és az `appendEngineEvent` SZÁNDÉKOSAN két külön SQL utasítás, nem egy
közös, kapcsolóra elágazó függvény.** A SPEC-003 6.6 szekció "Melyik esemény fajták esnek a
kapcsoló alá" alszekciója szerint a kapcsoló kizárólag a `sdk_stream_event` `kind`-ra hat; a
motor eredetű `kind` értékek sosem esnek alá. Ha a két útvonal egy közös, gated SQL-t osztana
meg, az `appendEngineEvent`-nek elméletben kezelnie kellene a "kihagyva" (`skipped`) ágat is,
holott ez a hívó (a motor) számára SOSEM fordulhat elő - az `EngineRunEventKind` típus
(`Exclude<RunEventKind, \`sdk_\${string}\`>`, lásd lent) fordítási időben kizárja a
`sdk_stream_event`értéket. Egy ilyen, típusilag garantáltan holt ág bevezetése a SPEC-003 12.4
szekció 100 százalékos, kizárás nélküli lefedettségi küszöbét sértené (nem volna hozzá
legitim módon előidézhető teszt), ezért az`insert-engine-event-row.ts` `insertEngineEventRow`függvénye **nem** tartalmazza a gated`WHERE`feltételt (a gate ott mindig igaz lenne), az`appendSdkEvent`belső`insertSdkEventRow` segédje pedig a repository fájlon belül, egyedi
használatra marad (nincs kiszervezve saját fájlba, "no abstraction for single-use code").

**`insertEngineEventRow` PLAIN, tranzakció nélküli segédfüggvény, a `run-event` téma mappában,
de a barrelen kívül.** Ez teszi lehetővé, hogy a `WorkflowRunRepository.startRun`
(`workflow-run-repository.ts`) ugyanazt a függvényt hívja, ugyanabban a tranzakcióban, mint a
futás sor beszúrása - beágyazott `database.transaction()` hívás nélkül. A `RunEventRepository`
téma → `workflow-run` téma irány (a `run-event.ts` tábla már importálja a `workflowRunTable`-t
onnan) miatt a relatív import iránya fordított a `run-event-repository.ts`/`insert-engine-event-
row.ts` → `workflow-run.ts` (csak a tábla fájl, nem a repository) felé nem okoz kört: a
`workflow-run.ts` tábla fájl nem importál semmit a `run-event` témából, és az
`insert-engine-event-row.ts` nyers SQL-lel, Drizzle tábla objektum importja nélkül dolgozik
(a `workflow_run` és a `run_event` táblanevet szó szerint írja a SQL szövegbe).

**A `startRun` a visszaadott `Outcome`-ot szándékosan nem ágaztatja el.** A `run_started` esemény
beszúrása a `workflow_run` sor beszúrása UTÁN, UGYANABBAN a tranzakcióban történik: a `not_found`
hibaág emiatt logikailag kizárt ezen a hívási ponton (a SQLite egy kapcsolat egy, még nem
commitolt tranzakcióján belül mindig látja a saját írását). Egy `if (!isOkOutcome(...))` ág ide
egy soha nem futó, tesztelhetetlen branch-et vinne be - ezért a `startRun` egyszerűen meghívja és
nem vizsgálja az eredményt, részletes indoklással a forráskódban. Az `insertEngineEventRow`
`not_found` ága a saját, közvetlen tesztjében (`insert-engine-event-row.spec.ts`) és a
`RunEventRepository.appendEngineEvent` ismeretlen `runId`-s tesztjében (`run-event-
repository.spec.ts`) fedett, valódi, előidézhető úton.

**Az `EngineRunEventKind` a 13 `engine` eredetű `kind` értéket TypeScript szinten szűkíti, nem
futásidejű guarddal.** A tizenkét `sdk` eredetű `RunEventKind` érték mindegyike `sdk_` előtaggal
kezdődik (`run-event-kind.ts`), a tizenhárom `engine` eredetű egyike sem - a
`Exclude<RunEventKind, \`sdk_\${string}\`>`ezt a mintát használja ki, tehát a két lista nem
futhat szét egymástól: egy jövőbeli`sdk_`előtagú bővítés automatikusan kimarad, minden más
automatikusan bekerül. Az`appendEngineEvent`hívója (a motor) így fordítási időben nem tud`sdk_`eredetű`kind`-ot átadni, nincs szükség külön `isEngineRunEventKind` guardra (a SPEC-003
9.4 szekció explicit guard listája sem sorol fel ilyet).

**A `duplicate_event` hibaosztály (19. kritérium).** Az `insertSdkEventRow` elkapja a
`better-sqlite3` `run_event_run_uuid_uq` egyedi index sértését (`SqliteDatabase.SqliteError`,
`code: 'SQLITE_CONSTRAINT_UNIQUE'`), és `duplicate_event` `Outcome` hibaágra fordítja. **Ez NEM
ugyanaz a minta, mint a `provider-concurrency-repository.ts` `setLimit`-jében a
`SQLITE_CONSTRAINT_CHECK` elkapásánál** - az a Drizzle TÍPUSOS insert-builder saját `.run()`-ját
hívja, ami a nyers `SqliteError`-t közvetlenül dobja, míg az `insertSdkEventRow` a nyers
`database.run(sql\`...\`)`-t (a Drizzle `BaseSQLiteDatabase.run`, `sqlite-core/db.js`), ami a
`session.run()`-on át minden hibát egy ÚJ `DrizzleError`-ba csomagol, az eredeti hibát a `.cause`
mezőben hordozva (`sqlite-core/session.js`, forráskódból ellenőrizve, nem feltételezve) - a catch
ágnak emiatt a `.cause`-t kell vizsgálnia, nem magát a kapott hibát. Ezt a kiszedést a
`extract-error-cause.ts` `extractErrorCause`végzi, KÜLÖN fájlban: az`error instanceof Error`
elágazás "false" oldala a hívási helyen (`insertSdkEventRow`catch ága) a gyakorlatban sosem áll
elő (a`DrizzleError`mindig`Error`példány), ami a SPEC-003 12.4 szekció 100 százalékos branch
lefedettsége mellett egy le nem fedhető ágat hagyna ott - kiemelve viszont szintetikus (nem`Error`) bemenettel is közvetlenül tesztelhető, ugyanaz a minta, mint a `core`csomag`describeError`-ja. Minden más hibakód (pl. `SQLITE_CONSTRAINT_FOREIGNKEY`, lásd
`run-event-repository.spec.ts`FK sértéses tesztje) továbbrepül, a`transaction`wrapper alakítja`Outcome`-má.

**Az `aggregateRunTokens` `COALESCE(SUM(...), 0)` nyers SQL-lel.** SQLite-ban egy `GROUP BY`
nélküli aggregát lekérdezés mindig pontosan egy sort ad, akkor is, ha nulla sor illeszkedik a
`WHERE`-re (ellenőrizve, saját méréssel, `better-sqlite3` 13.0.3 alatt) - a `COALESCE` ilyenkor
`NULL` helyett 0-t ad. Ezért ez az egyetlen `database.get<T>()` hívás a csomagban, aminél a
Drizzle deklarált (`undefined`-et nem tartalmazó) visszatérési típusa ténylegesen helyes, nem
csak a típusdefiníció pontatlansága: nincs itt `row === undefined` ellenőrzés és
`eslint-disable` sem, szemben a `readStoredCanonicalText`/`transitionRun`/`insertSdkEventRow`
hasonló mintájával. Mivel a `normalizeSdkMessage` (T-003-20) `sdk_stream_event` sorból soha nem
tölti a négy `usage` oszlopot, ez az összesítés a delta kapcsoló mindkét állásában azonos
eredményt ad (60., 61. kritérium, tesztelve `run-event-repository.spec.ts`-ben, ugyanazzal a
bemeneti sorozattal mindkét állásra).

## A `HumanApprovalRepository` (T-003-22)

A `human-approval-repository.ts` a `requestApproval`, `decideApproval`, `getApprovalForStep` és
`listPendingApprovals` műveletet adja, `openDatabase` köti be a `DatabaseContext.approvals`
mezőbe (`sqlite-connection/open-database.ts`). A barrel csak a `HumanApprovalRepository` típust
és a bemeneti/kimeneti típusait exportálja, a `createHumanApprovalRepository` factory függvényt
nem (SPEC-002 6.6 5. szabálya, SPEC-003 9.3 szekció). Az `ApprovalDecision` unió és az
`isApprovalDecision` guard a `human-approval/approval-decision.ts` és
`human-approval/is-approval-decision.ts` fájlban él, mindkettő a barrelben is szerepel.

**A `stepRuns` a `createHumanApprovalRepository` HARMADIK paramétere, a már létrehozott
`StepRunRepository` példány, nem a factory függvény.** A `requestApproval` a
`markStepWaitingApproval`-t, a `decideApproval` a `markStepSucceeded`/`markStepRejected`-et
hívja, ugyanabban a tranzakcióban, mint a saját `human_approval` sor módosítása (SPEC-003 9.2
szekció). Ha a fájl a `createStepRunRepository` factory függvényt importálná és saját maga
hozna létre egy második `StepRunRepository` példányt ugyanarra a `database`/`transaction`
párra, az egy felesleges, második zárványt jelentene ugyanazon a táblán, második ok nélküli
indirekcióval - ehelyett az `open-database.ts` adja át a már meglévő `stepRuns` mezőt, ott,
ahol az MINDEN repository közül már létezik (`open-database.ts`, a `createHumanApprovalRepository`
hívása a `stepRuns` létrehozása UTÁN áll). A fájl emiatt `import type`-tal hivatkozik a
`StepRunRepository`-ra (`../step-run/step-run-repository.ts`), a `createStepRunRepository`
futásidejű importja nélkül - nincs körkörös függés, mert a `step-run` téma egyetlen fájlja sem
importál semmit a `human-approval` témából.

**A tranzakció-beágyazás SAVEPOINT alapú, nem beágyazott `BEGIN`.** A `stepRuns.markStep*`
függvények maguk is a megosztott `transaction` függvényt hívják meg (`createHumanApprovalRepository`
második paramétere, ugyanaz a példány, mint amit a `stepRuns` kapott az `open-database.ts`-ben).
Amikor a `decideApproval`/`requestApproval` saját `transaction()` hívásán BELÜLről meghívja ezt
újra, a `better-sqlite3` `Database.prototype.transaction()` a `db.inTransaction` állapotot
látva automatikusan `SAVEPOINT`/`RELEASE`/`ROLLBACK TO` hármast használ `BEGIN`/`COMMIT`/`ROLLBACK`
helyett (forrásból ellenőrizve: `better-sqlite3/lib/methods/transaction.js`, `wrapTransaction`
függvény, `if (db.inTransaction) { before = savepoint; ... }` ág). Ez a dokumentált, beépített
nesting mechanizmus teszi lehetővé, hogy a `stepRuns.markStepSucceeded`/`markStepRejected`
hibaága a teljes, KÜLSŐ tranzakciót (a `human_approval` sor módosításával együtt) visszagörgesse:
a belső hívás `Outcome` hibaágat ad vissza (nem dob kivételt közvetlenül a hívó felé, mert a
`transaction()` wrapper elkapja a `TransactionRollback`-ot és `Outcome`-má alakítja), a
`decideApproval`/`requestApproval` ezt a hibaágat **továbbadja saját hibaágaként**, ami a SAJÁT
`transaction()` hívásán belül `TransactionRollback`-ot dob, és ez már a KÜLSŐ (a `human_approval`
`UPDATE`/`INSERT`-et is tartalmazó) `database.transaction()` hívást buktatja - így az egész
művelet egyetlen atomi egység, futtatott teszttel igazolva (`human-approval-repository.spec.ts`,
"ha a lépés állapotváltás hibázik, a human_approval.decision írása is visszagördül").

**A `step_run_id` egyediségét a `human_approval_step_uq` NÉV szerint hivatkozható `uniqueIndex()`
adja, nem a column builder `.unique()` metódusa.** A Drizzle 0.45.2 mindkettőt támogatja
(`.unique(name?: string)` az oszlopépítőn, külön `config.uniqueConstraints` tömbbe kerülve; a
`uniqueIndex()` a tábla extra configban, `config.indexes` tömbbe kerülve), de a SPEC-003 4.12
szekció szó szerint "indexek" közé sorolja a `human_approval_step_uq`-t, és ugyanez a minta él
már a `run_event_run_uuid_uq`-nál (`run-event.ts`) - a két mechanizmus együtt alkalmazva
redundáns, egymástól független megszorítást hozna létre ugyanarra az oszlopra.

**A `listPendingApprovals` SZÁNDÉKOSAN nem a `toHumanApprovalRecord`-on (a `decision` typeguard
ellenőrzésén) át képezi le a sorokat.** A `decision !== null && !isApprovalDecision(decision)`
feltétel a `WHERE decision IS NULL` szűrésű lekérdezésre alkalmazva egy típusilag garantáltan
holt ágat vinne be - a `decision !== null` mindig hamis lenne, hiszen a `WHERE` feltétel ezt már
kikényszerítette -, ami a SPEC-003 12.4 szekció 100 százalékos, kizárás nélküli lefedettségi
küszöbét sértené. Ugyanaz az elv, mint a `run-event-repository.ts` `insertEngineEventRow`/
`appendEngineEvent` szétválasztásánál (lásd fent, "Az `appendSdkEvent` és az `appendEngineEvent`
SZÁNDÉKOSAN két külön SQL utasítás"). A `listPendingApprovals` ezért egy külön, hibaágat nem
visszaadó `toPendingApprovalRecord` segédfüggvényt használ, ami a `decision` mezőt közvetlenül
`null`-ra írja, a lekérdezés által garantált tény alapján, nem a nyers oszlopérték
újraellenőrzésével. A `toHumanApprovalRecord` (a typeguarddal ellenőrző változat) a
`decideApproval` (ahol a `decision` mindig a hívó által megadott, érvényes `ApprovalDecision`)
és a `getApprovalForStep` (ahol a nyers oszlopérték korrupt is lehet, mert a `decision` oszlopon
nincs DB szintű `CHECK`) hívási úton marad, és az `invalid_approval_decision` hibaág a
`getApprovalForStep`-en át, egy közvetlenül beszúrt korrupt sorral tesztelt.

**A `decideApproval` compare-and-set `UPDATE ... WHERE step_run_id = ? AND decision IS NULL`
alakban fut**, a `RETURNING` záradékkal. Nulla módosított sor esetén egy külön `SELECT` dönti
el, hogy a sor hiányzik-e (`not_found`) vagy már el van döntve (`already_decided`) - ez a
diagnosztikai olvasás ugyanabban, a hívó számára láthatatlan tranzakcióban fut, tehát nem
versenyhelyzet-érzékeny.

## A `markRunInterrupted`/`markStepInterrupted` és a `RunRecovery` (T-003-24)

**Két hiányzó, nevesített állapotváltó pótlása.** A SPEC-003 9.2 szekció `WorkflowRunRepository`/
`StepRunRepository` táblázata nem sorolt fel `markRunInterrupted`/`markStepInterrupted` metódust
(csak a `markRun*`/`markStep*` négy, illetve hat aktív útvonalát), holott a `canTransitionRunStatus`/
`canTransitionStepRunStatus` a `pending`/`running`(/`waiting_approval`) -> `interrupted` átmenetet a
T-003-13/T-003-17 óta ismeri (7.1, 7.2 táblázat). A T-003-24 ezt a hiányt zárja le: mindkét
repository kapott egy `markRunInterrupted(runId)`/`markStepInterrupted(stepRunId)` metódust, szó
szerint ugyanazzal a compare-and-set mintával (`transitionRun`/`transitionStep` belső segéd,
`finishedAtMs: new Date()` extra oszloppal), mint a többi `markRun*`/`markStep*` függvény -
`illegal_status_transition` hibaágukat a saját `.spec.ts` fájljuk (`workflow-run-repository.spec.ts`,
`step-run-repository.spec.ts`) teszteli, közvetlen, valódi hívással egy már terminális sorra.

**A `run-recovery` téma (`run-recovery.ts`) SZÁNDÉKOSAN NEM ezt a két metódust hívja soronként
iterálva**, hanem két tömeges `UPDATE ... WHERE status IN (...)` utasítást ad ki (SPEC-003 7.4
szekció pszeudokódja, PLAN-003 T-003-24 "Compare and set jelentése itt" bekezdése, ami expliciten
mindkét alakot megengedte, "a meglévő kód stílusa alapján" döntésre bízva). Az indok nem
stílus: ha `recoverInterruptedRuns` a `markRunInterrupted`/`markStepInterrupted` hívás
`Outcome`-ját ellenőrizné, az `illegal_status_transition` ág EBBEN a hívási kontextusban
garantáltan holt lenne - a `runId`/`stepRunId` ugyanabban a tranzakcióban, ugyanazon a
`better-sqlite3` kapcsolaton lett kiválasztva `pending`/`running`(/`waiting_approval`) szűréssel,
és WAL módban is csak egy író van (F-8), tehát a compare-and-set mindig talál sort. Egy ilyen,
sosem futó ág bevezetése a SPEC-003 12.4 szekció 100 százalékos, kizárás nélküli lefedettségi
küszöbét sértené. A két nevesített metódus emiatt önmagában létezik és önmagában tesztelt, a
`run-recovery` témának nem függősége.

**`recoverInterruptedRuns()` lépései, egyetlen tranzakcióban** (`run-recovery.ts`):

1. `UPDATE workflow_run SET status = 'interrupted', finished_at_ms = :now WHERE status IN
('pending', 'running') RETURNING id` - a `NON_TERMINAL_RUN_STATUSES` konstans (`readonly
RunStatus[]`) adja a listát, típusosan, nem szabad szövegként. A `RETURNING id` egy kérésben
   adja vissza az érintett futások azonosítóját (`.returning({ id: ... }).all()`), tehát nincs
   szükség külön `SELECT`-re előtte - ugyanaz az elv, mint a `transitionRun` egysoros
   `RETURNING`-jánál, csak itt sok sorra egyszerre.
2. Nulla érintett futásnál azonnali `{ recoveredRunCount: 0 }` visszatérés, esemény írása nélkül.
3. `UPDATE step_run SET status = 'interrupted', finished_at_ms = :now WHERE run_id IN (:runIds)
AND status IN ('pending', 'running', 'waiting_approval')` - a `NON_TERMINAL_STEP_RUN_STATUSES`
   konstans adja a listát. Csak a fenti 1. lépésben ténylegesen megszakított futások lépés
   futásait érinti: egy már terminális futáshoz tartozó, adatilag inkonzisztens nem terminális
   lépés futás (ha volna ilyen) érintetlen marad, mert a `runId` nincs a listában.
4. Futásonként EGY `run_interrupted` motor esemény (`origin: 'engine'`, `stepRunId: null`,
   `payload: { runId }`), az `insertEngineEventRow` (`run-event/event-record/insert-engine-event-row.ts`)
   PLAIN, tranzakció nélküli segédfüggvénnyel - ugyanaz a minta, mint a
   `workflow-run-repository.ts` `startRun`-jában a `run_started` eseménynél, beleértve azt is,
   hogy a visszaadott `Outcome`-ot itt sem ágaztatjuk el (a `not_found` ág logikailag kizárt,
   mert a `runId` az imént, ugyanebben a tranzakcióban lett kiolvasva).

**Terminális futás és a hozzá tartozó terminális lépés futás érintetlen marad** (kulcsteszt,
`run-recovery.spec.ts`): egy `succeeded` futás és `succeeded` lépés futás egy őrjel
`finished_at_ms` értékkel előre megjelölve, a helyreállítás után a sor bitre változatlan - ez
bizonyítja, hogy a `WHERE status IN (...)` szűrés ténylegesen kizárja a terminális sorokat, nem
csak véletlenül marad ugyanaz az érték.

**A `DatabaseContext.recovery` mező, az utolsó.** Az `open-database.ts` a `createRunRecovery(database,
transaction)` hívással köti be - a függvény NEM kapja meg a `WorkflowRunRepository`/
`StepRunRepository` példányt (ellentétben a `HumanApprovalRepository`-val, ami a `stepRuns`
példányt kapja), mert a fenti tömeges `UPDATE` közvetlenül a Drizzle tábla objektumokra
(`workflowRunTable`, `stepRunTable`) épül, nem a repository rétegen át. Ezzel a `run-recovery`
a `packages/db/src` alatti 12., egyben utolsó téma mappa (SPEC-003 8. szekció); a barrel a
`RunRecovery` és a `RecoverInterruptedRunsResult` típust exportálja, a `createRunRecovery`
factory függvényt nem (SPEC-002 6.6 5. szabálya, SPEC-003 9.3 szekció).

**Az `openDatabase` NEM hívja meg automatikusan a `recoverInterruptedRuns`-t.** A SPEC-003 7.4
szekció szó szerint: "a szerver indulásakor, mielőtt bármilyen hálózati kapcsolatot fogadna,
lefut a helyreállítás" - a `packages/db` egy adatbázis csomag, nem tudja, mikor "fogad hálózati
kapcsolatot". A `packages/db` csak a képességet adja
(`DatabaseContext.recovery.recoverInterruptedRuns()`), a tényleges hívás az `apps/server`
felelőssége lesz, egy KÉSŐBBI specifikációban.

## Az adverzariális átvizsgálás megállapításai (T-003-27)

**A barrel exportlistája gépi ellenőrzést kapott.** A SPEC-003 4. kritériuma nem csak a
zártságot követeli meg, hanem azt is, hogy "ezt egy `.spec.ts` mechanikusan igazolja a barrel
exportált kulcsainak listáján" - ilyen fájl eddig nem létezett. A
`sqlite-connection/barrel-exports.spec.ts` pótolja: (1) a futásidejű névtér kulcsai pontosan a
hét exportált ÉRTÉK (`ENV_EASTER_DB_FILE`, `resolveDatabaseFilePath`, `defaultDatabaseFilePath`,
`ensureDatabaseDirectory`, `openDatabase`, `isRunEventKind`, `isApprovalDecision`), (2) a barrel
forrásszövegéből kiolvasott `export { ... } from '...'` utasítások minden modul útvonala `./`
kezdetű (tehát külső csomag szimbóluma nem szivároghat ki), és (3) egyetlen exportált név sem
végződik `Table`-re, és nem `drizzle`/`BetterSQLite3Database`/`SqliteDatabase`/`Database`. A
harmadik teszt épség ellenőrzést is végez: a forrásszövegből kiolvasott névlistának tartalmaznia
kell mind a hét futásidejű nevet, tehát a minta bizonyítottan a valódi export utasításokra
illeszkedik, nem üresen fut le. A teszt nem üres voltát mérés igazolja: egy ideiglenesen
hozzáadott `export { workflowTable } from './workflow-graph/workflow.ts';` sorra a három
tesztből kettő megbukik.

**Miért nem `src/index.spec.ts` a helye.** A SPEC-003 1. kritériuma tiltja, hogy a barrelen
kívül bármilyen fájl közvetlenül a `src/` alatt álljon. A `sqlite-connection` az a téma, ami a
tiltott szimbólumokat ténylegesen tartja (a `drizzle()` példány és a `better-sqlite3` handle az
`open-database.ts` lezárásában, SPEC-003 9.1), tehát a zártságot ott kell bizonyítani.
Implementációs pár nélküli `.spec.ts`-nek van előzménye a csomagban
(`graph-snapshot/graph-snapshot-immutability.spec.ts`).

**Az `as const` NEM type assertion, és nem sérti a 32. kritériumot.** A `packages/db/src` alatt a
termékkódban két `as` előfordulás van, mindkettő `status: 'pending' as const`
(`workflow-run-repository.ts`, `step-run-repository.ts`). A `@typescript-eslint/consistent-type-assertions`
szabály `assertionStyle: 'never'` beállítással (`tooling/eslint-config/src/eslint-preset/base.ts`)
a const assertiont explicit kiveszi: `if (isConst(node.typeAnnotation) && messageId === 'never')
{ return; }` (`@typescript-eslint/eslint-plugin@8.68.0`,
`dist/rules/consistent-type-assertions.js`, telepített forrásból ellenőrizve). A `satisfies` itt
nem helyettesíti: saját méréssel igazolva, hogy `{ status: 'pending' satisfies RunStatus }` a
mutálható objektum literál mezőjében `string`-gé szélesedik, és a `RunStatus` mezőre nem
értékelhető. Type assertion (`as SomeType`) sem a termékkódban, sem a tesztekben nincs.

**NYITOTT PONT: az `isGraphSnapshotHash` guard nem létezik.** A SPEC-003 9.4 szekció tíz elemű,
kimerítő guard listájából kilenc megvan (`isNodeType`, `isNodeConfig`, `isAgentStepConfig`,
`isRunStatus`, `isStepRunStatus`, `isRunEventKind`, `isApprovalDecision`, `isProviderId`,
`isGraphSnapshotDocumentV1`), a tizedik, az `isGraphSnapshotHash` (64 karakteres kisbetűs
hexadecimális szöveg, F-24) sehol nem áll a `packages/db/src` alatt.

- **Mi a viselkedés addig.** A lenyomat sosem hívói bemenet: kizárólag a `computeSnapshotHash`
  állítja elő a kanonikus szövegből (`graph-snapshot/compute-snapshot-hash.ts`), és a
  `startRun` ugyanabban a tranzakcióban írja a `graph_snapshot.hash` és a
  `workflow_run.graph_snapshot_hash` oszlopba. Egyetlen exportált művelet bemenete sem fogad
  lenyomat szöveget (`StartRunInput`-ban nincs ilyen mező, a `readSnapshot` `runId`-t kap),
  tehát ma nincs olyan határ, ahol a guard bármit elkapna.
- **Mi zárná le.** Egy döntés arról, hogy a `WorkflowRunRecord.graphSnapshotHash` nyers `string`
  helyett kapjon-e szűkített `GraphSnapshotHash` típust, és a `toWorkflowRunRecord` olvasáskor
  ezzel a guarddal szűkítsen-e, ugyanúgy, ahogy az `isProviderId` teszi a `provider_id`
  oszlopon. Enélkül a guard használat nélküli, spekulatív kód lenne (a gyökér `CLAUDE.md`
  "Simplicity First" szabálya), ezért a T-003-27 nem vezeti be magától.

**A `vitest.config.ts` `coverage.exclude` listáján van egy `packages/db` specifikus bejegyzés,
de az NEM SPEC-003 eredetű, és semmire nem illeszkedik.** A `'packages/db/**/migrations/**'` sor
a SPEC-001 idejéből származik (`4e7fe05`, "feat(ci): Vitest és Playwright infrastruktúra"), és a
generált SQL migrációk mappája ma `packages/db/drizzle/`, nem `migrations/`, tehát a minta nulla
fájlra illeszkedik. A 39. kritérium ("a `coverage.exclude` listája egyetlen sorral sem bővült")
ettől függetlenül teljesül. Nyitva hagyott, szándékosan nem javított pont: a sor törlése
SPEC-001 örökség, nem tartozik a `packages/db` hatókörébe, és a lefedettségre bizonyíthatóan
nincs hatása.

## `Outcome` hibaosztály konvenció

A csomag a megosztott `Outcome<T>` típust használja a `@easter-workflow-builder/core`
csomagból, módosítás nélkül (`{ kind: 'error'; message: string }`). A SPEC-003 12.4 szekciója
"hibaosztályokat" nevez meg (pl. `database_closed`, `not_found`); ezek nem külön mezőt kapnak,
hanem a hibaosztály neve szó szerint, zárójelben szerepel a `message` szövegében (pl. "... le
van zárva (database_closed)."), hogy a tesztek stabilan `.toContain(...)` tudjanak rá
ellenőrizni, a hibaüzenet mégis emberi nyelvű maradjon. Ezt a mintát minden további téma
követi.

**A `foreign_key_violation` hibaosztály, a `transaction()` fallback ágán (T-003-28
átvizsgálás, 40. kritérium).** A `duplicate_event`, az `invalid_max_concurrent_steps` és a
`graph_snapshot` trigger (`SQLITE_CONSTRAINT_TRIGGER`) mind saját, specifikusabb repository
szintű `catch` ágban dől el, MIELŐTT a hiba a `transaction()`-ig jutna - de az idegen kulcs
sértésnek (`SQLITE_CONSTRAINT_FOREIGNKEY`) idáig nem volt saját fordítása, tehát a nyers
`describeError(error)` `Error.message`-e ment tovább, nevesítés nélkül, megsértve a fenti
konvenciót. A `sqlite-connection/describe-transaction-error.ts` `describeTransactionError`
mechanikusan pótolja ezt: a `transaction()` (`open-database.ts`) fallback ágán, ha az elkapott
hiba `SqliteDatabase.SqliteError` és a kódja `SQLITE_CONSTRAINT_FOREIGNKEY`, az üzenet
kiegészül a `(foreign_key_violation)` jelöléssel; minden más hibakód (és minden más, a hívó
saját `catch`-ában már lefordított eset) változatlanul a nyers `describeError`-t kapja - nincs
ütközés a meglévő, specifikusabb fordításokkal. **Csak a Drizzle TÍPUSOS insert-builder
közvetlen `SqliteError`-ját fedi** (a `workflow-repository.ts` `replaceGraph`-ja
`.insert(...).run()` alakban ír, becsomagolás nélkül) - a `run-event-repository.ts`
`insertSdkEventRow`-jának raw `sql` `INSERT ... SELECT`-je egy MÁSIK, `DrizzleError`-ba
csomagolt idegen kulcs sértési utat termel (`run-event-repository.spec.ts` "egy váratlan
adatbázis hiba (nem egyedi index sértés) továbbrepül" tesztje), amit ez a fordítás
SZÁNDÉKOSAN nem fed le: a helyi `makeTransaction` másolat abban a spec fájlban változatlan
maradt, mert a T-003-28 lezárása csak ehhez az egy, ténylegesen bizonyított kritériumhoz
(`workflow-repository.spec.ts` "idegen kulcs sértés" tesztje) tartozó útvonalat kívánta
mechanikusan javítani, redesign nélkül. A `describe-transaction-error.spec.ts` közvetlen,
szintetikus (`SqliteDatabase.SqliteError`) bemenettel fedi mindhárom ágat (nem `SqliteError`,
`SqliteError` más kóddal, `SqliteError` FK kóddal), a `run-event/event-record/extract-error-cause.spec.ts`
mintáját követve.

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
