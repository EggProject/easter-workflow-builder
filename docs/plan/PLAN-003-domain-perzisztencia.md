# PLAN-003: Domain modell és perzisztencia végrehajtási terv

|              |                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------ |
| Státusz      | tervezet                                                                                         |
| Dátum        | 2026-08-27                                                                                       |
| Spec         | [`../spec/SPEC-003-domain-perzisztencia.md`](../spec/SPEC-003-domain-perzisztencia.md)           |
| Konvenció    | [`../spec/SPEC-002-csomag-architektura.md`](../spec/SPEC-002-csomag-architektura.md), 6. szekció |
| Verzióforrás | [`../research/2026-08-26-toolchain.md`](../research/2026-08-26-toolchain.md)                     |
| Branch       | `feat/spec-003-domain-perzisztencia`                                                             |

Ez a terv a SPEC-003-at végrehajtható, egyenként ellenőrizhető lépésekre bontja. Minden lépéshez tartozik azonosító, egymondatos leírás, függőség, a végrehajtó subagent `model` beállítása és elfogadási kritérium.

## 1. Előfeltételek

| Feltétel             | Elvárt érték                                                 | Ellenőrzés                        |
| -------------------- | ------------------------------------------------------------ | --------------------------------- |
| Feature branch       | `feat/spec-003-domain-perzisztencia` a friss `main`-ről      | `git rev-parse --abbrev-ref HEAD` |
| SPEC-002 lezárva     | 25 workspace csomag, 19 a `packages/` alatt, nyolc kapu zöld | `bun run check:graph`             |
| Node.js              | 26.7.0                                                       | `node -v`                         |
| Bun                  | 1.4.0, csak csomagkezelő                                     | `bun -v`                          |
| Tiszta munkakönyvtár | nincs uncommitted változás                                   | `git status --porcelain` üres     |

A `main` védett, közvetlen push tiltott, a zárás PR-rel történik. Az `npm` és az `npx` nem használható, csak `bun run` és `bun x`.

## 2. A nyolc minőségi kapu

**Minden lépés végén mind a nyolc parancs nulla kilépési kóddal fut, és a lépés csak ezután commitolható.**

| Parancs                | Mit őriz                                                    |
| ---------------------- | ----------------------------------------------------------- |
| `bun run typecheck`    | típushelyesség a teljes workspace-en                        |
| `bun run lint`         | `any`, `as`, `private`, kör, deklarálatlan függőség tilalma |
| `bun run format:check` | Prettier                                                    |
| `bun run test`         | Vitest, 100 százalék lefedettség mind a négy metrikán       |
| `bun run build`        | build task                                                  |
| `bun run docs:check`   | `CLAUDE.md` minden csomag gyökerében                        |
| `bun run check:casing` | a git index betűzése egyezik a relatív importokéval         |
| `bun run check:graph`  | aciklikus gráf, szigorúan csökkenő rétegszám                |

Ebből következik a lépések bontásának alapszabálya: **egy lépés soha nem hagy hátra futásidejű sort a hozzá tartozó `.spec.ts` fájl nélkül.** A tábla, a hozzá tartozó unió, a typeguardjai, a repositoryja és a tesztjei ugyanabban a lépésben keletkeznek. A `coverage.exclude` lista egyetlen sorral sem bővülhet.

## 3. Modell hozzárendelés

| Modell   | Mikor                                                                                                                         |
| -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `sonnet` | részletes specifikáció alapján végzett kódolás, séma írás, migráció generálás, recon, webes verzió ellenőrzés, wrapper script |
| `opus`   | tervezés (node config unió, pillanatkép verziózás, SDK üzenet normalizálás), adverzariális ellenőrzés, hibakeresés            |

A `model` mező soha nem hagyható üresen abban a hitben, hogy örököl valamit.

## 4. Todo lépések

### F1 fázis: a nyitott kérdések lezárása, kód írása előtt

Ez a fázis a SPEC-003 13. szekció `O-5`, `O-6`, `O-7`, `O-8` pontjait zárja le, és rögzíti a hiányzó verziókat. Amíg ez nyitva van, séma nem íródik, mert egy nem betölthető natív modul vagy egy nem működő `drizzle-kit` konfiguráció az egész fázissort visszafordítaná.

| ID      | Leírás                                                                                                                                                                            | Függőség | Modell | Elfogadási kritérium                                                                                                                                                                                                                      |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-003-1 | Feature branch és kiinduló állapot ellenőrzése, a nyolc kapu lefuttatása a munka kezdete előtt.                                                                                   | nincs    | sonnet | `git rev-parse --abbrev-ref HEAD` a branch nevét adja, `git status --porcelain` üres, mind a nyolc kapu nulla kilépési kóddal fut.                                                                                                        |
| T-003-2 | A `drizzle-kit` és a `@types/better-sqlite3` pontos verziójának megállapítása élő npm registry lekérdezéssel, és a `docs/research/2026-08-26-toolchain.md` táblázatának bővítése. | T-003-1  | sonnet | Mindkét verzió létező npm verzió, forrás URL-lel; a research táblázat bővült; tippelt verzió nincs; a `drizzle-orm` és a `better-sqlite3` sora változatlan.                                                                               |
| T-003-3 | O-7 lezárása: a `better-sqlite3` telepítése és importálása Node 26 alatt, helyben és a CI runner képére, prebuild vagy forrásfordítás megállapításával.                           | T-003-2  | sonnet | Futtatott próba kimenete rögzítve: a modul betölthető, egy `new Database(':memory:')` és egy `SELECT 1` lefut; a prebuild vagy forrásfordítás ténye a `docs/research/` alá van vezetve; ha nem tölthető be, a blokkoló nevesítve van.     |
| T-003-4 | O-8 és O-5 lezárása: `drizzle-kit generate` próbafuttatása egy eldobható sémán, a `schema` glob felszedésének és a "nincs séma változás" viselkedésnek a megállapításával.        | T-003-2  | sonnet | Futtatott próba igazolja, hogy a glob felszedi az összes téma mappa tábláját, vagy megállapítja, hogy explicit útvonallista kell; külön futtatás igazolja, mit tesz a parancs séma változás nélkül; az eredmény a `docs/research/` alatt. |
| T-003-5 | O-6 lezárása: a `run_graph_snapshot` módosítást tiltó SQLite trigger pontos szintaxisának próbája `drizzle-kit generate --custom` migrációban.                                    | T-003-4  | sonnet | Futtatott próba: az `UPDATE` a triggerrel hibázik, az `INSERT` és a `DELETE` nem; a trigger SQL szó szerint rögzítve a research fájlban; ha nem használható, a tény és az indok rögzítve, és a T-003-15 tárgytalanná válik.               |

A próbákhoz keletkező eldobható kód nem maradhat a repóban. Az F1 fázis egyetlen repóbeli nyoma a `docs/research/` alá vezetett tényanyag és a `docs/research/2026-08-26-toolchain.md` bővített verziótáblázata.

### F2 fázis: a `ProviderId` unió és a csomag függőségei

| ID      | Leírás                                                                                                                                                                                        | Függőség         | Modell | Elfogadási kritérium                                                                                                                                                                                                                                             |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-003-6 | A `@easter-workflow-builder/provider-capability` csomag `provider-id` téma mappája a `ProviderId` unióval, és a `provider-registry` `ProviderRegistry` interfészének átkötése erre a típusra. | T-003-1          | sonnet | A `provider-capability/src/provider-id/provider-id.ts` létezik, duplikált mappaszint nélkül; a barrel nevesítve exportálja; a `ProviderRegistry` kulcsai ebből a unióból jönnek; a `provider-registry.spec.ts` változatlan invariánsokkal zöld; nyolc kapu zöld. |
| T-003-7 | A `packages/db` függőségeinek felvétele: `drizzle-orm`, `better-sqlite3`, `@types/better-sqlite3`, `drizzle-kit`, valamint a `typeguards` és a `provider-capability` workspace csomag.        | T-003-6, T-003-3 | sonnet | A négy külső csomag literál verzióval, a T-003-2 értékeivel áll a `package.json` fájlban, katalógus hivatkozás nélkül; a `bun install --frozen-lockfile` hibátlan; a `check:graph` L2 -> L1 élt lát, nem sértést; nyolc kapu zöld.                               |

### F3 fázis: adatbázis fájl és kapcsolat

| ID      | Leírás                                                                                                                                         | Függőség | Modell | Elfogadási kritérium                                                                                                                                                                                                                                                                |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-003-8 | `database-file` téma: az `EASTER_DB_FILE` env változó **nevének** feloldása, az alapértelmezett fejlesztői útvonal, a könyvtár létrehozása.    | T-003-7  | sonnet | A téma mappa létezik a spec 8. szekció szerinti névvel; a modul csak env változó nevet ismer, értéket nem tárol; minden ág (env beállítva, env hiányzik, könyvtár hiányzik) saját teszteset; nyolc kapu zöld.                                                                       |
| T-003-9 | `sqlite-connection` téma: `openDatabase`, a pragmák a spec 10.2 szerinti sorrendben, a `drizzle()` bekötés séma objektum nélkül, és a `close`. | T-003-8  | sonnet | A `foreign_keys` pragma a nyitás első lépése, minden tranzakció előtt; fájl alapú DB-n `journal_mode = wal`, `:memory:` DB-n meg sem próbálja, mindkét ág tesztelve; a `close` utáni művelet `database_closed` hibaágat ad; az `IS_DB_PLACEHOLDER` export törölve; nyolc kapu zöld. |

A T-003-9 az első lépés, ami valódi exportot tesz a `packages/db` barreljébe, ezért itt szűnik meg a placeholder export (SPEC-002 6.6 6. szabálya).

### F4 fázis: a workflow gráf és a migrációs lánc

| ID       | Leírás                                                                                                                                                                               | Függőség         | Modell | Elfogadási kritérium                                                                                                                                                                                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-003-10 | `drizzle.config.ts`, a `migration` téma, a `workflow`, `workflow_node` és `workflow_edge` tábla, az első generált migráció, és a `migrate()` bekötése az `openDatabase` folyamatába. | T-003-9, T-003-4 | sonnet | A `drizzle/` mappa commitolt SQL migrációt tartalmaz; a `:memory:` adatbázis a commitolt migrációkkal épül fel; a `sqlite_master` a három táblát és a `__drizzle_migrations` táblát mutatja; a `PRAGMA foreign_key_list` a spec szerinti `ON DELETE` értékeket; nyolc kapu zöld. |
| T-003-11 | A `NodeType` unió tíz ága, a node config unió, az `AgentStepConfig`, a `StorableMcpServer` (csak env **név** mezőkkel) és a hozzájuk tartozó typeguardok.                            | T-003-10         | opus   | Minden mező visszavezethető az Agent SDK `Options` típusára a research 1. szekciója szerint, kitalált mező nincs; a config uniónak nincs olyan mezője, ami env **értéket** fogadna; minden guard `unknown` bemenetet fogad, saját `.spec.ts` fájllal; nyolc kapu zöld.           |
| T-003-12 | `WorkflowRepository`: `createWorkflow`, `updateWorkflow`, `getWorkflow`, `listWorkflows`, `replaceGraph`, `readGraph`, `summarizeDeletion`, `deleteWorkflow`.                        | T-003-11         | sonnet | A `deleteWorkflow` bemenete kötelezően tartalmazza az `acknowledgeIrreversible: true` literált; a `replaceGraph` egy tranzakcióban cserél; a kaszkád törlés futtatott teszttel igazolt; nincs node és él szintű CRUD; nyolc kapu zöld.                                           |

### F5 fázis: futás és gráf pillanatkép

| ID       | Leírás                                                                                                                                                               | Függőség          | Modell | Elfogadási kritérium                                                                                                                                                                                                                                                |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-003-13 | `workflow_run` tábla, a `RunStatus` hat állapota, az átmeneti szabály függvény, az önhivatkozó `root_run_id` és `restarted_from_run_id`, és a migráció.              | T-003-12          | sonnet | A hat állapot és a spec 7.1 táblázatának minden átmenete tesztelve, érvénytelen átmenet mindegyikére hibaág; a `root_run_id` kaszkádja futtatott teszttel igazolt; a `workflow_ancestry` JSON oszlop `unknown` típusú; nyolc kapu zöld.                             |
| T-003-14 | `graph-snapshot` téma: a dokumentum típusa, a `GRAPH_DOCUMENT_VERSION` konstans, a verziódiszpécser `readGraphSnapshot`, a verzió typeguard és az első fixture.      | T-003-13          | opus   | A `switch` kimerítő, a `switch-exhaustiveness-check` szabály hatálya alatt; ismeretlen verzió nevesített hibaágat ad, kivétel nem repül ki; létezik commitolt fixture és a hozzá tartozó `.spec.ts`; az olvasó nem ír vissza az adatbázisba; nyolc kapu zöld.       |
| T-003-15 | A `run_graph_snapshot` tábla, a migrációja, és a módosítást tiltó trigger a T-003-5 eredménye szerinti custom migrációban.                                           | T-003-14, T-003-5 | sonnet | A tábla elsődleges kulcsa a `run_id`, `ON DELETE CASCADE` idegen kulccsal; az `UPDATE` kísérlet hibázik; ha a T-003-5 a triggert kizárta, a lépés a repository szintű zártságra szűkül, és a tény a `CLAUDE.md` fájlban áll; nyolc kapu zöld.                       |
| T-003-16 | `WorkflowRunRepository`: `startRun` egy tranzakcióban (futás, pillanatkép, `run_started` esemény előkészítése), állapotváltók compare and set módon, `readSnapshot`. | T-003-15          | sonnet | A `startRun` az egyetlen beszúrási út a `workflow_run` táblára; nincs exportált művelet, ami pillanatkép nélküli futást hozna létre; minden állapotváltó tartalmazza a várt jelenlegi állapotot a `WHERE` feltételben és nulla sornál hibaágat ad; nyolc kapu zöld. |

A T-003-16 `run_started` eseménye a `run_event` tábla megjelenéséig (T-003-19) nem íródik. A lépés ezt nyitott ponttal jelöli a kódban, és a T-003-21 zárja le; a tranzakciós határ már itt a végleges.

### F6 fázis: lépés futás

| ID       | Leírás                                                                                                                                                         | Függőség | Modell | Elfogadási kritérium                                                                                                                                                                                                                                                |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-003-17 | `step_run` tábla a spec 4.10 mezőivel, a `StepRunStatus` nyolc állapota, az átmeneti szabály függvény, a `parent_step_run_id` fa és a migráció.                | T-003-16 | sonnet | A `node_id` **nem** idegen kulcs; nincs egyediségi megszorítás a `(run_id, node_id, iteration, attempt)` négyesen; a nyolc állapot minden érvényes és érvénytelen átmenete tesztelve; a `parent_step_run_id` kaszkádja futtatott teszttel igazolt; nyolc kapu zöld. |
| T-003-18 | `StepRunRepository`: létrehozás, lista, a hat nevesített állapotváltó, `attachSession`, és a token összesítés írása a terminális átmenettel egy tranzakcióban. | T-003-17 | sonnet | Nincs általános `updateStatus` metódus; a `markStepSucceeded` strukturált kimenetet váró lépésnél csak akkor sikerül, ha a kimenet megvan (a spec 7.2 M-34 következménye); a token összesítés egyszer íródik és utána nem változik; nyolc kapu zöld.                |

### F7 fázis: esemény tábla

| ID       | Leírás                                                                                                                                                               | Függőség | Modell | Elfogadási kritérium                                                                                                                                                                                                                                                                   |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-003-19 | `run_event` tábla a spec 6.2 mezőivel, a `RunEventKind` 25 értéke, a három index és a migráció.                                                                      | T-003-18 | sonnet | Az `id` `INTEGER PRIMARY KEY AUTOINCREMENT`, és a `sqlite_sequence` tábla létezik; teszt igazolja, hogy a legnagyobb azonosítójú sor törlése után a következő beszúrás nem használja újra az azonosítót; a `(run_id, sdk_uuid)` egyedi index több NULL sort megenged; nyolc kapu zöld. |
| T-003-20 | Az SDK üzenet normalizálása: typeguard alapú kinyerés a nyers üzenetből, minden normalizált mező nullable, költség oszlop nélkül.                                    | T-003-19 | opus   | Egyetlen kinyert mező sem hivatkozik olyan SDK mezőre, amit a research fájlok nem neveznek meg; hiányzó mező NULL-t ad, nem kitalált értéket; a `total_cost_usd` nem kap normalizált oszlopot, és a nyers `payload` tartalmazza; minden ág tesztelve; nyolc kapu zöld.                 |
| T-003-21 | `RunEventRepository`: `appendSdkEvent`, `appendEngineEvent`, `readEventsSince`, `readEventsForStep`, `aggregateRunTokens`, és a T-003-16 nyitott pontjának lezárása. | T-003-20 | sonnet | A `readEventsSince` `limit` paramétere kötelező, alapérték nélkül; ugyanaz az `sdk_uuid` kétszer beszúrva `duplicate_event` hibaágat ad; a `startRun` immár tényleg beírja a `run_started` eseményt ugyanabban a tranzakcióban; nyolc kapu zöld.                                       |

### F8 fázis: jóváhagyás, beállítások, helyreállítás

| ID       | Leírás                                                                                                          | Függőség | Modell | Elfogadási kritérium                                                                                                                                                                                                                                                      |
| -------- | --------------------------------------------------------------------------------------------------------------- | -------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-003-22 | `human-approval` téma: tábla, `ApprovalDecision`, a két index, a migráció és a repository.                      | T-003-21 | sonnet | A `step_run_id` egyedi index; a `decideApproval` a döntést és a lépés állapotváltását egy tranzakcióban végzi; a `body` és a `payload` a kérés pillanatában rögzül; a függő jóváhagyások lekérdezés a `(decision, requested_at_ms)` indexből szolgál ki; nyolc kapu zöld. |
| T-003-23 | `app-setting` és `provider-concurrency` téma: két tábla `CHECK` constraintekkel, migráció, és a két repository. | T-003-22 | sonnet | Az `app_setting` `CHECK (id = 1)` egysoros; a `default_provider_id` a migráció után NULL; a `provider_concurrency_limit` tábla a migráció után üres, és sem a kódban, sem a migrációban nincs szállított párhuzamossági alapérték; nyolc kapu zöld.                       |
| T-003-24 | `run-recovery` téma: az indulási helyreállítás egy tranzakcióban, `run_interrupted` eseménnyel.                 | T-003-23 | sonnet | `pending` és `running` futás és a hozzájuk tartozó nem terminális lépés futások mind `interrupted` állapotba kerülnek, futásonként egy eseménnyel; terminális futás érintetlen; az `interrupted` állapotból nincs kimenő átmenet; nyolc kapu zöld.                        |

### F9 fázis: eszközök, átvizsgálás, zárás

| ID       | Leírás                                                                                                                                                                                                         | Függőség | Modell | Elfogadási kritérium                                                                                                                                                                                                                                                             |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-003-25 | Token takarékos drift ellenőrző wrapper a `tooling/scripts` alatt, npm scriptként és CI lépésként bekötve.                                                                                                     | T-003-24 | sonnet | A wrapper nem nulla kilépési kóddal fut, ha a séma és a commitolt migrációk eltérnek, és nullával, ha nem; a stdout csak összegzés, a hiba a stderr-en; egy szándékosan hozzáadott oszlopon igazoltan jelez; nyolc kapu zöld.                                                    |
| T-003-26 | Konfigurációs átvezetések: `EASTER_DB_FILE` a `turbo.json` `globalPassThroughEnv` listájába, `.data/` és az SQLite kísérőfájlok a `.gitignore` fájlba, és a `packages/db/CLAUDE.md` átírása a 12 téma mappára. | T-003-25 | sonnet | A `turbo run typecheck` látja a változót; a `.gitignore` fedi a `-wal` és `-shm` kísérőfájlt; a `CLAUDE.md` `## Fájlok` táblázata mind a 12 téma mappát felsorolja, és a `docs:check` zöld; nyolc kapu zöld.                                                                     |
| T-003-27 | Adverzariális átvizsgálás: forrás nélküli szám, kitalált SDK mező, `any`, `as`, megkerülhető séma garancia, titok az adatbázisban.                                                                             | T-003-26 | opus   | Minden számhoz és küszöbhöz megnevezhető a forrás vagy a saját mérés; ahol nincs, az érték eltávolítva vagy nyitott kérdésként jelölve; a barrel exportlistáján nincs Drizzle tábla, `drizzle()` példány vagy `better-sqlite3` szimbólum; a jelentés listázza a talált pontokat. |
| T-003-28 | A SPEC-003 mind a 44 elfogadási kritériumának tételes végigmérése, kritériumonként megnevezett bizonyítékkal.                                                                                                  | T-003-27 | opus   | Mind a 44 pont teljesül, vagy a nem teljesülő pont mellett áll a blokkoló és a lezáró lépés; érveléssel igazolt pont nincs, mindegyik mögött futtatott parancs vagy teszt áll.                                                                                                   |
| T-003-29 | A nyolc kapu teljes futtatása és commit logikai egységenként (ProviderId, kapcsolat, gráf, futás, pillanatkép, lépés, esemény, jóváhagyás, eszközök).                                                          | T-003-28 | sonnet | Mind a nyolc parancs nulla kilépési kóddal fut; `git status --porcelain` üres; a `.data/` és a `bun.lock` állapota rendben; a commit üzenetek a SPEC-003-ra hivatkoznak; a user értesítve, hogy pusholnia kell, a branch nevével együtt.                                         |
| T-003-30 | PR nyitása a `feat/spec-003-domain-perzisztencia` branchről a `main` ellen, a user push-a után.                                                                                                                | T-003-29 | sonnet | A PR leírása hivatkozik a SPEC-003 44 elfogadási kritériumára, felsorolja a lezárt `O-*` pontokat, a nyitva maradtakat és a halasztott lépést (a domain típusok jövőbeli `protocol` csomagba költöztetését).                                                                     |

## 5. Fázis függőségek

| Fázis | Bemenete | Miért nem indulhat előbb                                                                              |
| ----- | -------- | ----------------------------------------------------------------------------------------------------- |
| F1    | nincs    | ez zárja az O-5, O-6, O-7, O-8 pontot; egy nem betölthető natív modul az egész tervet visszafordítaná |
| F2    | F1       | a függőség felvételéhez ismerni kell a pontos verziókat                                               |
| F3    | F2       | a kapcsolat a telepített driverre épül                                                                |
| F4    | F3       | a migráció futtatásához kell a kapcsolat                                                              |
| F5    | F4       | a futás idegen kulcsa a `workflow` táblára mutat                                                      |
| F6    | F5       | a lépés futás idegen kulcsa a `workflow_run` táblára mutat                                            |
| F7    | F6       | az esemény idegen kulcsa mindkettőre mutat                                                            |
| F8    | F7       | a jóváhagyás a lépés futásra mutat, a helyreállítás mindkét állapotgépet és az esemény táblát érinti  |
| F9    | minden   | zárás                                                                                                 |

A fázisok szigorúan sorosak, mert a séma idegen kulcs láncot alkot, és minden lépés után élő migrációnak kell lennie. Egyetlen kivétel: a T-003-2, T-003-3 és a T-003-4 párhuzamosítható, mert a T-003-3 és a T-003-4 külön csomagot mér.

## 6. Kockázat kezelés a végrehajtás alatt

| Helyzet                                                                                | Mit teszünk                                                                                                                                                                          |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A `better-sqlite3` nem tölthető be Node 26 alatt (T-003-3)                             | a terv megáll az F1 végén; a tény a `docs/research/` alá kerül, és a driver kérdését a userrel kell tisztázni. Alternatív drivert nem választunk magunktól, és `bun:sqlite` tiltott. |
| A `drizzle-kit` glob nem szedi fel a téma mappák tábláit (T-003-4)                     | a `drizzle.config.ts` `schema` mezője explicit útvonallistát kap, téma mappánként egy bejegyzést. A tény a research fájlba kerül, a terv nem áll meg.                                |
| A pillanatkép trigger nem működik (T-003-5)                                            | a T-003-15 a repository szintű zártságra szűkül, ami önmagában is érvényes védelem (SPEC-003 5.5, 1. pont). A 19. elfogadási kritérium ekkor a repository felületre vonatkozik.      |
| Egy lépés után a lefedettség 100 százalék alá esne                                     | a lépés nem zárható le. A hiányzó teszt ugyanabban a lépésben íródik, a `coverage.exclude` lista **nem** bővül.                                                                      |
| A node config unió a T-003-11 alatt SDK mezőt kívánna, amit a research nem támaszt alá | a mező kimarad, és nyitott kérdésként a specbe kerül. Mezőt nem találunk ki, és nem olvasunk vissza az SDK típusdefinícióból a research megkerülésével.                              |
| A `run_event` normalizálás olyan mezőt kívánna, ami nincs dokumentálva                 | ugyanaz: az oszlop kimarad, az adat a nyers `payload` JSON-ban marad, ahol nem sugallja, hogy összegezhető.                                                                          |
| A `check:graph` sértést jelez a `db` új függősége miatt                                | a `package-layer.ts` térkép nem módosul a `db` kedvéért. Ha az él tiltott, a típus rossz csomagban van, és a típust kell mozgatni, nem a réteget.                                    |
| Az adverzariális átvizsgálás forrás nélküli számot talál (T-003-27)                    | a szám eltávolításra kerül, és a helyére nyitott kérdés áll a "mi a viselkedés addig" és a "mi zárná le" mezővel. Küszöböt nem hagyunk bent indoklás nélkül.                         |

## 7. Definition of Done

1. Az F1 fázis mind a négy nyitott pontja (O-5, O-6, O-7, O-8) lezárt, futtatott próbával, és az eredmény a `docs/research/` alatt áll forrás URL-lel (T-003-3, T-003-4, T-003-5).
2. A `drizzle-kit` és a `@types/better-sqlite3` verziója a `docs/research/2026-08-26-toolchain.md` táblázatában áll, élő registry lekérdezésből, tippelés nélkül (T-003-2).
3. A `@easter-workflow-builder/provider-capability` csomagban van `provider-id` téma mappa a `ProviderId` unióval, duplikált mappaszint nélkül, és a `provider-registry` ezt használja (T-003-6).
4. A `packages/db` `dependencies` mezője `core`, `logger`, `typeguards` és `provider-capability`, a négy külső csomag literál verzióval áll, és a `check:graph` nulla kilépési kóddal fut (T-003-7).
5. A `packages/db/src` alatt pontosan 12 téma mappa áll a SPEC-003 8. szekció szerint, egy szint mélyen, az `index.ts` barrelen kívül egyetlen fájl sem áll közvetlenül a `src/` alatt (T-003-8 ... T-003-24).
6. Az `IS_DB_PLACEHOLDER` export megszűnt, és a barrel csak nevesített újraexportot tartalmaz (T-003-9).
7. Az `openDatabase` a spec 10.2 sorrendjében jár el: `foreign_keys` pragma minden kapcsolaton és minden tranzakció előtt, `journal_mode = wal` csak fájl alapú adatbázison, majd migrációk, majd `drizzle()` séma objektum nélkül (T-003-9, T-003-10).
8. A séma pontosan 10 saját táblát definiál, a migrációk a `packages/db/drizzle` mappában commitolva állnak, és a `:memory:` teszt adatbázis ezekkel a fájlokkal épül fel (T-003-10 ... T-003-23).
9. A kaszkád lánc végigfut: workflow törlése után a futás, a pillanatkép, a lépés futás, az esemény, a jóváhagyás és az al-workflow futásainak sorszáma nulla, futtatott teszttel igazolva (T-003-12, T-003-13).
10. Pragma nélkül nyitott kapcsolaton a kaszkád igazoltan nem fut le, a rendes úton nyitottan igen (T-003-9, T-003-12).
11. A `startRun` az egyetlen beszúrási út a `workflow_run` táblára, és egy tranzakcióban írja a futást, a pillanatképet és a `run_started` eseményt (T-003-16, T-003-21).
12. A pillanatkép verziózás működik: `GRAPH_DOCUMENT_VERSION`, kimerítő `switch`, nevesített hibaág ismeretlen verzióra, commitolt fixture és regressziós teszt; az olvasó soha nem ír vissza (T-003-14).
13. Egy futás pillanatképe akkor is a futáskori gráfot adja, ha a workflow-t azóta átírták vagy a node-jait törölték, futtatott teszttel igazolva (T-003-14, T-003-15).
14. A `run_graph_snapshot` sor módosítási kísérlete hibázik, vagy adatbázis triggerrel, vagy a repository felület zártságával, a T-003-5 eredménye szerint (T-003-15).
15. A két állapotgép teljes: hat futás állapot, nyolc lépés futás állapot, minden érvényes átmenet sikerül, minden érvénytelen `illegal_status_transition` hibaágat ad, és minden állapotváltó compare and set módon dolgozik (T-003-13, T-003-17).
16. Az indulási helyreállítás minden `pending` és `running` futást és a nem terminális lépés futásaikat `interrupted` állapotba viszi, futásonként egy eseménnyel, egy tranzakcióban; az `interrupted` terminális (T-003-24).
17. A `run_event.id` `AUTOINCREMENT`, és teszt igazolja, hogy a legnagyobb azonosítójú sor törlése után a következő beszúrás nem használja újra az azonosítót (T-003-19).
18. A `run_event` normalizált oszlopai közül minden SDK eredetű nullable, egyik sem hivatkozik a research fájlokban nem szereplő SDK mezőre, és költség oszlop nincs (T-003-20).
19. A `readEventsSince` `limit` paramétere kötelező, alapérték nélkül, és ugyanaz az `sdk_uuid` kétszer beszúrva `duplicate_event` hibaágat ad (T-003-21).
20. Az `AgentStepConfig` MCP szerver mezője kizárólag env változó nevet tárol, értéket nem, és ezt teszt igazolja (T-003-11, T-003-12).
21. A `provider_concurrency_limit` tábla a migráció után üres, az `app_setting.default_provider_id` NULL, és sem a kódban, sem a migrációban nincs szállított párhuzamossági alapérték (T-003-23).
22. Létezik drift ellenőrző wrapper a `tooling/scripts` alatt, npm scriptként és CI lépésként bekötve, és egy szándékos séma eltérésre igazoltan jelez (T-003-25).
23. A repóban nincs `drizzle-kit push` hívás sem npm scriptben, sem CI workflowban, sem ajánlásként (T-003-25, T-003-27).
24. Az `EASTER_DB_FILE` a `turbo.json` `globalPassThroughEnv` listájában áll, a `.data/` és az SQLite kísérőfájl minta a `.gitignore` fájlban (T-003-26).
25. A `packages/db/CLAUDE.md` a csomag gyökerében áll, mind a 12 téma mappát felsorolja, és sem téma mappában, sem a `drizzle/` mappában nincs `CLAUDE.md` (T-003-26).
26. A `packages/db/src` alatt nincs `any` és nincs `as`; minden JSON oszlop `.$type<unknown>()` alakú, a szűkítést typeguard végzi, és minden domain guardhoz tartozik saját `.spec.ts` (T-003-11 ... T-003-24, T-003-27).
27. Minden `.spec.ts` valós `better-sqlite3` adatbázis ellen fut, mockolt adatbázis nincs, és a WAL ág egy ideiglenes fájl alapú adatbázison van lefedve (T-003-9 ... T-003-24).
28. A SPEC-003 12.4 szekciójában felsorolt mind a 11 hibaosztályhoz tartozik olyan teszteset, ami ténylegesen előidézi (T-003-28).
29. Az adverzariális átvizsgálás nem talált forrás nélküli számot, kitalált SDK mezőt vagy megkerülhető séma garanciát; ahol talált, az javítva vagy nyitott kérdésként jelölve (T-003-27).
30. A SPEC-003 mind a 44 elfogadási kritériuma teljesül, kritériumonként futtatott parancsra vagy tesztre hivatkozva (T-003-28).
31. Mind a nyolc minőségi kapu nulla kilépési kóddal fut a teljes workspace-en, és a lefedettség mind a négy metrikán 100 százalék, kizárás bővítése nélkül (T-003-29).
32. A munka commitolva van a `feat/spec-003-domain-perzisztencia` branchen, a user értesítve a push szükségességéről, és a PR nyitva a `main` ellen, a lezárt és a nyitva maradt `O-*` pontokkal, valamint a halasztott lépés megnevezésével (T-003-29, T-003-30).
