# Tároló motor értékelés, 2026-08-27

|            |                                                                                                                            |
| ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| Kiváltó ok | user felvetés: az SQLite alkalmatlan mindent tárolni, a pillanatkép túl sok lenne, kell-e fájl alapú vagy másik motor      |
| Tárgy      | a [`../spec/SPEC-003-domain-perzisztencia.md`](../spec/SPEC-003-domain-perzisztencia.md) SQLite döntésének felülvizsgálata |
| Módszer    | négy jelentés adverzariális ellenőrzése élő forrásból, plusz saját mérés valós SPEC-000 adaton                             |
| Verdikt    | maradjon SQLite; a premissza a pillanatkép méretére nem áll meg, de egy valós duplikációs problémát tapint ki              |

---

## 1. Összefoglaló, három mondatban

A mért adatok szerint az SQLite nem szűk keresztmetszet ezen a terhelésen: egymillió esemény sor 681,1 MiB, a teljes futás transcript kurzoros visszaolvasása 0,5 ms fedő index (`COVERING INDEX`) használatával, a beszúrás 177 462 sor per másodperc. A pillanatkép sem az: egy húsz node-os, tipikus profilú workflow dokumentuma 79,7 KiB, ami négy nagyságrenddel az SQLite alapértelmezett 1 000 000 000 bájtos sorhatára alatt van, és az sqlite.org saját 100 KB-os hüvelykujjszabálya alatt is, tehát az adatbázisban tárolás a gyorsabb ág. A felhasználó ösztöne mégis valós problémát tapint ki, csak rossz helyre teszi az okát: 5000 futásnyi változatlan gráf pillanatképe 391,0 MiB, amiből a hasznos információ 79,7 KiB, és ez a duplikáció a SPEC-003 5. szekció adatmodelljéből ered, nem az SQLite-ból, tehát motorváltással nem javul.

## 2. Mérési módszer és környezet

Minden szám ebben a fájlban vagy a most futtatott saját mérésből, vagy megnevezett hivatalos forrásból származik. Nincs extrapoláció.

| Elem                | Érték                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| Futtatókörnyezet    | Linux arm64 konténer, Node.js v26.7.0, Bun 1.4.0                                                         |
| SQLite motor        | `better-sqlite3` 13.0.3 és `node:sqlite`, mindkettő SQLite 3.53.4                                        |
| Bemenő valós adat   | `tools/wire-probe/artifacts`, 341 rögzített HTTP tranzakció, 87 MB, a SPEC-000 mérési körökből           |
| Kinyert SSE esemény | 240 darab `/anthropic/v1/messages` válaszból 6143 darab `data:` esemény, összesen 624 563 bájt           |
| Séma a méréshez     | a SPEC-003 6.2 `run_event` mezőkészlete és a 6.5 mindhárom indexe, betűre                                |
| Payload alakja      | `SDKPartialAssistantMessage` boríték a telepített SDK `sdk.d.ts` 4484 sora szerint, valós SSE eseménnyel |

**A környezet korlátja, kimondva.** A mérés Linux arm64 alatt futott. macOS arm64 mérésünk nincs, ezért minden abszolút szám erre az egy platformra érvényes. Az arányok (index költség, tárolási szorzó, motorok közti különbség) platformfüggetlen SQLite viselkedésből erednek, de ezt itt nem mértük.

**Az SDK boríték nem tétel nélküli.** A `SDKPartialAssistantMessage` a nyers Anthropic streaming eseményt négy mezővel csomagolja: `type`, `parent_tool_use_id`, `uuid`, `session_id`. A mért hatás: a nyers esemény átlag 101,7 bájt, a borítékkal együtt eltárolt JSON átlag 257,7 bájt, tehát a boríték 2,5-szeresére nagyítja a payloadot.

## 3. Adverzariális ellenőrzés: mit erősítettünk meg és mit nem

### 3.1 Megerősített állítások

| Állítás                                                                                                | Forrás                                                             |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Max string és BLOB alapból 1 000 000 000 bájt, implementációs felső határ 2^31-3                       | https://sqlite.org/limits.html                                     |
| Ugyanez a max sorméret: "the maximum number of bytes in a row"                                         | https://sqlite.org/limits.html                                     |
| Max adatbázis 4 294 967 294 oldal, 4096 bájtos oldallal kb 17,5 TB                                     | https://sqlite.org/limits.html                                     |
| Az alapértelmezett `page_size` 4096 bájt a 3.12.0 (2016-03-29) verzió óta                              | https://sqlite.org/pgszchng2016.html                               |
| 100 KB alatt gyorsabb az adatbázisban, fölötte külön fájlban; a szöveg "rules of thumb"                | https://sqlite.org/intern-v-extern-blob.html                       |
| WAL: "readers do not block writers", és "there can only be one writer at a time"                       | https://sqlite.org/wal.html                                        |
| A "Server-side database" eset: "requests are serialized by the server, so concurrency is not an issue" | https://sqlite.org/whentouse.html                                  |
| `better-sqlite3` 13.0.3 (2026-08-05), `engines.node >=22`, prebuild a három platformunkra              | https://registry.npmjs.org/better-sqlite3/latest                   |
| README mérés: 2000 lekérdezés per másodperc öt táblás joinnal 60 GB-os adatbázison                     | https://github.com/WiseLibs/better-sqlite3                         |
| `options.timeout` alapérték 5000 ms                                                                    | https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md |
| `node:sqlite` Node 26 alatt "Stability: 1.2, Release candidate", szinkron `DatabaseSync`               | https://nodejs.org/docs/latest-v26.x/api/sqlite.html               |
| Nincs hivatalos SQLite sorszám-küszöb, ahol a teljesítmény romlik                                      | https://sqlite.org/limits.html                                     |
| PGlite négy mutexe létezik: `#queryMutex`, `#transactionMutex`, `#listenMutex`, `#fsSyncMutex`         | a 0.5.8 tarball sourcemap `sourcesContent` mezője, `src/pglite.ts` |
| PGlite: nincs `.node`, `.so`, `.dylib` a csomagban, WASM-ra fordított Postgres                         | a 0.5.8 tarball tartalma                                           |
| PGlite: hivatalos Drizzle driver van (`drizzle-orm/pglite`)                                            | https://orm.drizzle.team/docs/connect-pglite                       |
| DuckDB: "Appends will never conflict, even on the same table"; a Quack protokoll béta                  | https://duckdb.org/docs/stable/connect/concurrency                 |
| DuckDB: nincs `duckdb` bejegyzés a `drizzle-orm` `exports` térképében, csak közösségi csomag           | a `drizzle-orm@0.45.2` package.json                                |
| DuckDB pozicionálás: OLAP, oszlopos vektorizált végrehajtás                                            | https://duckdb.org/why_duckdb                                      |
| A Level szervezet `rocksdb` csomagja npm szinten `deprecated: "Discontinued"`                          | https://registry.npmjs.org/rocksdb/latest                          |
| Kuzu: a repót 2025-10-10-én archiválták, az npm csomag `deprecated`                                    | https://github.com/kuzudb/kuzu, https://registry.npmjs.org/kuzu    |
| `@alcalzone/jsonl-db` `open()` a teljes tartalmat memóriabeli `Map`-be tölti, nincs lapozás            | a 4.0.2 tarball `build/cjs/lib/db.js`                              |
| `jexidb` 2.2.1: nincs `types` mező és nincs `.d.ts` a tarballban                                       | a 2.2.1 tarball                                                    |
| `fs/promises`: "not synchronized or threadsafe... data corruption may occur"                           | https://nodejs.org/docs/latest-v26.x/api/fs.html                   |

### 3.2 Cáfolt vagy árnyalt állítások

| Eredeti állítás                                                         | Amit a forrás valójában mond                                                                                                                                                                                                                                                |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A WAL nem alkalmas nagy tranzakciókra                                   | Ez a mondat át van húzva a hivatalos doksiban. Jelenlegi szöveg: a 3.11.0 (2016-02-15) óta a WAL ugyanolyan hatékony nagy tranzakciókkal, mint a rollback mód. https://sqlite.org/wal.html                                                                                  |
| `lmdb-js` kulcsméret max 511 bájt                                       | A 511 bájt a nyers LMDB C könyvtár `MDB_MAXKEYSIZE` alapértéke. Az `lmdb-js` README szerint a csomag alapértéke **1978 bájt**, `pageSize` 8192 fölött **4026 bájt**. Az eredeti állítás rossz szintre vonatkozik.                                                           |
| `lmdb-js` `mapSize` előre állítandó                                     | A README Design szekciója szerint a csomag automatikusan kezeli a növekedést, "expanding file size with a smart heuristic". A `mapSize` opcionális, nem kötelező.                                                                                                           |
| Az intern-v-extern-blob mérés egyetlen `page_size` mellett készült      | Hét különböző `page_size` értékkel mérték (1024 és 65536 között), SQLite 3.7.8-cal, ext4-en. A mérés **2011 környéki motorverzióval** készült, ezt kockázatként kell kezelni, nem friss tényként.                                                                           |
| `fs.createWriteStream` `finish` eseménye nem garantálja a lemezre írást | A Node doksi ezt **nem mondja ki szó szerint**. Amit mond: a `finish` akkor jön, ha az adat "flushed to the underlying system", míg az `fs.fsync` doksija "to the storage device" megfogalmazást használ. A különbség alátámasztja az állítást, de nem szó szerinti idézet. |
| `node:sqlite` támogatja a WAL-t                                         | **Nem ellenőrizhető a doksiból.** A Node 26 `sqlite` oldalán nem szerepel a "WAL" és a "journal_mode" szó. Az `exec()` tetszőleges SQL-t futtat, tehát feltehetően kiadható, de dokumentált állítás nincs rá.                                                               |
| A PGlite repóban 158 nyitott issue                                      | A GitHub `open_issues_count` mező 158, de ez issue-t és PR-t együtt számol. Tisztán issue-ra szűrve **116**, a maradék 42 nyitott pull request.                                                                                                                             |
| `jsonl-db` (matschik) 179 havi letöltés                                 | Ez a szám a `jexidb` csomaghoz tartozik. A `jsonl-db` letöltésszámát külön nem ellenőriztük. Nem befolyásolja a verdiktet, a csomag saját README-je zárja ki a célesetet.                                                                                                   |

### 3.3 Amit nem tudtunk ellenőrizni

- A LevelDB hivatalos dokumentációjában **nincs** olyan szekció, ami nagy értékek (blob) tárolásáról vagy a "sub-KB értékekre tervezett" szándékról szólna. A doksi annyit mond, hogy az adatelemek elvben 0 és 0xffffffff bájt között lehetnek. A write amplification állítás tehát a mi jelentésünkben forrás nélkül állt, és így nem használható érvként.
- A PGlite Node FS módjára **nincs** dokumentált méretkorlát. Az egyetlen dokumentált numerikus korlát a Safari OPFS 252 nyitott handle korlátja, ami minket nem érint.

## 4. A felhasználó premisszája: túl sok-e a pillanatkép az SQLite-nak

### 4.1 A mért pillanatkép méret

A SPEC-003 5.1 dokumentum alakja és a 4.4 `AgentStepConfig` mezőlistája alapján felépített, valós alakú dokumentumok mérete. A promptszövegek hossza feltevés, ezért három profil áll, mindegyik feltevése kimondva.

| Profil    | Feltevés                                                                                           | 1 node config | 10 node   | 50 node   | 200 node    |
| --------- | -------------------------------------------------------------------------------------------------- | ------------- | --------- | --------- | ----------- |
| takarékos | 200 karakteres prompt, nincs `systemPrompt` append, nincs subagent, nincs sémakimenet              | 1 037 B       | 13,9 KiB  | 68,8 KiB  | 274,9 KiB   |
| tipikus   | 1500 karakteres prompt, 500 karakteres append, 8 mezős JSON Schema                                 | 3 785 B       | 40,7 KiB  | 203,0 KiB | 811,6 KiB   |
| nehéz     | 6000 karakteres prompt, 3000 karakteres append, 2 subagent 800 karakteres prompttal, 25 mezős séma | 14 511 B      | 145,4 KiB | 726,7 KiB | 2 906,6 KiB |

Nagyságrendi tájékozódási pont a szövegméretekhez: a repó gyökér `CLAUDE.md` fájlja 16 596 bájt, a SPEC-003 maga 112 767 bájt. A "nehéz" profil 14 511 bájtos node configja tehát nagyjából egy `CLAUDE.md`-nyi szöveg egyetlen lépés beállításában, ami reális felső határ, nem karikatúra.

**A node szám nincs korlátozva sehol.** A SPEC-003 nem rögzít maximális node számot, és nincs mérésünk arról, hány node-os workflow-t fog a felhasználó rajzolni. A 10, 50 és 200 érték feltevés, nem mérés.

### 4.2 Mit mondanak a határok

| Küszöb                                                      | Érték           | Hol vagyunk hozzá képest                                       |
| ----------------------------------------------------------- | --------------- | -------------------------------------------------------------- |
| SQLite `SQLITE_MAX_LENGTH` alapérték, egyben a max sorméret | 1 000 000 000 B | a tipikus 20 node-os pillanatkép 81 604 B, azaz 0,008 százalék |
| ugyanez a nehéz profil 200 node-dal                         | 1 000 000 000 B | 2 976 358 B, azaz 0,3 százalék                                 |
| implementációs felső határ                                  | 2 147 483 645 B | ugyanez, feleakkora arány                                      |
| max adatbázis méret 4096 bájtos oldallal                    | kb 17,5 TB      | lásd 5. szekció                                                |
| intern-v-extern-blob hüvelykujjszabály                      | 100 KB          | a tipikus profil alatta van, a nehéz 200 node-os fölötte       |

### 4.3 A mért tárolási költség

5000 pillanatkép sor, húsz node-os tipikus dokumentummal, a SPEC-003 4.9 tábla alakja szerint, `run_graph_snapshot_version_idx` indexszel:

| Mérés                            | Eredmény             |
| -------------------------------- | -------------------- |
| egy dokumentum                   | 81 604 B (79,7 KiB)  |
| 5000 sor táblamérete             | 391,0 MiB            |
| bájt per sor                     | 81 990 B             |
| tárolási szorzó a nyers JSON-hoz | **1,00x**            |
| egy pillanatkép visszaolvasása   | 0 ms felbontás alatt |

Az 1,00x szorzó azt jelenti, hogy az SQLite a nagy `TEXT` értéket túlcsordulási oldalakon (overflow page) tárolja, gyakorlatilag mérhető adminisztratív többlet nélkül. Ez pontosan az a rész, amit a premissza az SQLite terhére ír, és a mérés szerint az SQLite itt nem tesz hozzá semmit.

### 4.4 A verdikt a premisszáról

**A premissza abban a formában, hogy "a pillanatkép túl sok lenne az SQLite-nak", nem áll meg.** A tipikus eset négy nagyságrenddel a sorméret határ alatt van, a tárolási többlet nem mérhető, az olvasás ezredmásodperc alatti, és a SPEC-003 4.9 döntése (külön tábla, nem oszlop a `workflow_run` táblán) már ma is megvédi a futás lista lekérdezést a dokumentum beolvasásától.

**De a premissza mögötti megérzés helyes, csak az ok más.** A 391,0 MiB-ból a hasznos információ 79,7 KiB, mert 5000 futás ugyanannak a változatlan gráfnak az 5000 azonos fényképét tárolja. A duplikációs arány legrosszabb esetben 5000:1. Ez az adatmodellből (SPEC-003 5. szekció: futásonként egy teljes, önálló dokumentum) következik, nem a motorból. **Bármelyik másik motor ugyanezt a bájtsort tárolná el ugyanannyiszor**, tehát a probléma motorváltással nem oldható meg. A 7.2 szekció ad rá két lehetőséget, mindkettőnek megnevezett árral.

## 5. Méretbecslés: mekkora adatbázis fájl várható

### 5.1 Az esemény sor mért költsége

A SPEC-003 6.2 mezőkészletével és a 6.5 mindhárom indexével, valós SSE eseményekből épített payloaddal:

| Mérés                           | 200 000 sor | 1 000 000 sor |
| ------------------------------- | ----------- | ------------- |
| fájlméret (WAL checkpoint után) | 136,2 MiB   | 681,1 MiB     |
| bájt per sor                    | **714 B**   | **714 B**     |
| bájt per sor index nélkül       | 508,7 B     | nem mérve     |
| nyers payload per sor           | 257,7 B     | 257,7 B       |
| tárolási szorzó                 | 2,77x       | 2,77x         |
| ugyanez index nélkül            | 1,97x       | nem mérve     |

A három index ára tehát mérve **205 B per sor**, a teljes sorköltség 29 százaléka. Ezért cserébe a kurzoros olvasás fedő indexből fut, lásd 5.3.

A 714 bájtos érték 200 ezer és egymillió sornál azonos, tehát ebben a tartományban lineáris, nem romlik.

### 5.2 Mennyi esemény keletkezik

A valós SPEC-000 mérési adaton:

| Mennyiség                                          | Median | p90 | Max   |
| -------------------------------------------------- | ------ | --- | ----- |
| SSE esemény egy `/v1/messages` válaszban           | 13     | 45  | 581   |
| SSE esemény egy probe futásban (több hívás együtt) | 157    | 932 | 1 738 |

Eseménytípus szerinti megoszlás a 6143 mért eseményen:

| Típus                 | Darab | Arány  | Összes bájt | Átlag bájt |
| --------------------- | ----- | ------ | ----------- | ---------- |
| `content_block_delta` | 4 415 | 71,9 % | 454 243     | 102,9      |
| `content_block_start` | 384   | 6,3 %  | 35 782      | 93,2       |
| `content_block_stop`  | 384   | 6,3 %  | 14 976      | 39,0       |
| `message_start`       | 240   | 3,9 %  | 68 050      | 283,5      |
| `message_delta`       | 240   | 3,9 %  | 42 392      | 176,6      |
| `message_stop`        | 240   | 3,9 %  | 5 520       | 23,0       |
| `ping`                | 240   | 3,9 %  | 3 600       | 15,0       |

**Ez a táblázat a legfontosabb tervezési lever a méretre.** Az `includePartialMessages: true` mellett rögzülő `content_block_delta` események adják az eseményszám 71,9 és a bájtmennyiség 72,7 százalékát. Ha ezek nem perzisztálódnak, csak a WebSocketre mennek ki, az esemény tábla a mért adat 28,1 százalékára esik darabszámban.

**Amit ez nem mond meg.** A probe futás egyetlen agent lépés, nem többlépéses workflow futás. Valós workflow futás eseményszámunk nincs, mert még nincs motor. A lenti forgatókönyvek ezért **feltevésre** épülnek, nem mérésre, és a feltevés minden sornál ki van írva.

### 5.3 Forgatókönyvek

Mindegyik a mért 714 B per esemény sor és 81 990 B per pillanatkép sor értékkel számol.

| Forgatókönyv | Feltevés                                                            | Esemény    | Esemény tábla | Pillanatkép tábla | Együtt   |
| ------------ | ------------------------------------------------------------------- | ---------- | ------------- | ----------------- | -------- |
| kicsi        | 500 futás, futásonként 160 esemény (a mért median), 20 node tipikus | 80 000     | 54,5 MiB      | 39,1 MiB          | 93,6 MiB |
| közepes      | 5 000 futás, futásonként 900 esemény (a mért p90 közelében)         | 4 500 000  | 3,0 GiB       | 391,0 MiB         | 3,4 GiB  |
| nagy         | 20 000 futás, futásonként 1 700 esemény (a mért max közelében)      | 34 000 000 | 22,6 GiB      | 1,5 GiB           | 24,1 GiB |

A `workflow`, `workflow_node`, `workflow_edge`, `step_run`, `human_approval` táblák a feladatban megadott tíztől néhány százig, illetve tízezres nagyságrendben mozognak, tehát a fenti számokhoz képest elhanyagolhatók, és nem mértük őket külön.

**A 17,5 TB-os SQLite adatbázis határ egyik forgatókönyvben sincs a közelben.** A nagy forgatókönyv 24,1 GiB, ami a határ 0,15 százaléka.

### 5.4 A lekérdezés sebessége egymillió soros táblán

1 000 000 esemény sor, 1000 futásra szétosztva, WAL módban:

| Művelet                                                                    | Mért idő       | Terv                                                         |
| -------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------ |
| teljes futás transcript kurzoros visszaolvasása, 200-as lapokkal, 1000 sor | 0,5 ms         | `SEARCH run_event USING COVERING INDEX run_event_run_id_idx` |
| első lap (200 sor) egy futásra                                             | 0 ms           | ugyanaz                                                      |
| `COUNT(*)` egy futásra                                                     | 0 ms           | ugyanaz                                                      |
| `COUNT(*)` a teljes táblán                                                 | 18 ms          | teljes bejárás                                               |
| egy futás 1000 eseményének törlése                                         | 47 ms          | ugyanaz                                                      |
| beszúrás, `node:sqlite`                                                    | 82 522 sor/mp  | tranzakcióban, 50 ezres kötegben                             |
| beszúrás, `better-sqlite3` 13.0.3                                          | 177 462 sor/mp | ugyanígy                                                     |

A SPEC-003 6.5 `run_event_run_id_idx` indexe `(run_id, id)` alakú, és a WebSocket replay lekérdezését fedő indexből szolgálja ki, tehát a fő tábla sorait nem is érinti. Ez magyarázza a 0,5 ms-t egymillió sor mellett.

### 5.5 Hol vannak a bizonytalanságok

| Bizonytalanság                                                 | Hatás a becslésre                                         |
| -------------------------------------------------------------- | --------------------------------------------------------- |
| a valós workflow futás eseményszáma nincs mérve                | az 5.3 forgatókönyvek szorzója akár nagyságrendet téved   |
| a valós node config szövegméretek ismeretlenek                 | a pillanatkép becslés 3 profil között 10x-es sávban mozog |
| a maximális node szám nincs korlátozva és nincs mérve          | a 200 node-os sor felfelé nyitott                         |
| 10 millió sor fölött nem mértünk                               | a 714 B per sor linearitása afölött nem igazolt           |
| macOS arm64-en nem mértünk                                     | az abszolút idők platformfüggők lehetnek                  |
| a MiniMax `MiniMax-M3` eseménysűrűsége eltérhet más modellétől | az 5.2 megoszlás erre az egy providerre mért              |

## 6. A jelöltek összehasonlítása

Azonos szempontok, azonos sorrendben. Az "egyidejűség" oszlop egy szerver processzre vonatkozik, ami a SPEC-003 7.4 rögzített feltevése.

| Jelölt                            | Adatmodell                     | Natív bináris                      | Egyidejűség                                                | Tranzakció                         | Relációs lekérdezés     | Kurzoros olvasás              | ORM támogatás                  | Karbantartottság                         | Verdikt                                 |
| --------------------------------- | ------------------------------ | ---------------------------------- | ---------------------------------------------------------- | ---------------------------------- | ----------------------- | ----------------------------- | ------------------------------ | ---------------------------------------- | --------------------------------------- |
| **`better-sqlite3` 13.0.3**       | relációs, SQL                  | igen, prebuild mind a 3 platformra | WAL: olvasó nem blokkolja az írót, egyszerre egy író       | teljes ACID, beágyazható           | teljes SQL, join, index | igen, fedő indexből, 0,5 ms   | hivatalos Drizzle dialektus    | 2026-08-05, aktív, `engines.node >=22`   | **ajánlott, marad**                     |
| `node:sqlite` (Node 26 beépített) | relációs, SQL                  | nem kell, a Node-ban van           | ugyanaz az SQLite motor (3.53.4)                           | ugyanaz                            | ugyanaz                 | ugyanaz                       | **nincs** Drizzle driver       | "Stability 1.2, Release candidate"       | tartalék, ma nem                        |
| `@electric-sql/pglite` 0.5.8      | relációs, teljes Postgres 18.3 | **nincs**, WASM                    | egy kapcsolat, 4 mutex szerializál mindent                 | teljes ACID                        | teljes Postgres SQL     | igen, mérve 3 ms              | hivatalos Drizzle driver       | 2026-08-26, aktív, 116 nyitott issue     | egyetlen komoly alternatíva, de lassabb |
| `@duckdb/node-api` 1.5.5-r.4      | relációs, **oszlopos OLAP**    | igen, prebuild mind a 3 platformra | MVCC, appendek nem ütköznek; több processz csak béta Quack | igen                               | teljes SQL              | igen                          | **nincs hivatalos**, közösségi | 2026-08-11, aktív                        | rossz munkaterhelés profil              |
| `lmdb` (lmdb-js) 3.5.6            | kulcs érték                    | igen, prebuild mind a 3 platformra | MVCC, snapshot izoláció, egy író                           | valódi ACID                        | **nincs**               | igen, natív cursor            | **nincs**                      | 2026-06-18, 26,5 M havi letöltés         | kizárva: nincs relációs lekérdezés      |
| `classic-level` 3.0.0             | kulcs érték                    | igen, széles prebuild kör          | egy processz                                               | csak atomi `batch`, nincs rollback | **nincs**               | igen, kulcssorrendben         | **nincs**                      | 2025-04-20                               | kizárva: nincs relációs lekérdezés      |
| `@harperfast/rocksdb-js` 2.8.0    | kulcs érték                    | igen                               | nem vizsgáltuk                                             | nem vizsgáltuk                     | **nincs**               | nem vizsgáltuk                | **nincs**                      | első kiadás 2026-01-27, nincs éles múlt  | kizárva: éretlen és rossz modell        |
| `rocksdb` (Level)                 | kulcs érték                    | igen                               | nem releváns                                               | nem releváns                       | **nincs**               | nem releváns                  | **nincs**                      | npm szinten `Discontinued`               | kizárva                                 |
| `kuzu` 0.11.3                     | gráf                           | igen                               | nem releváns                                               | nem releváns                       | Cypher                  | nem releváns                  | **nincs**                      | repó archiválva 2025-10-10, `deprecated` | kizárva                                 |
| `@alcalzone/jsonl-db` 4.0.2       | kulcs érték JSONL fájlban      | nincs                              | egy folyamat, `fsyncDir()` van                             | nincs                              | **nincs**               | **nincs**, teljes RAM-ba tölt | **nincs**                      | 2025-10-15, 76 556 havi letöltés         | kizárva: RAM-ba tölt, nincs lapozás     |
| `jsonl-db` (matschik) 2.0.0       | kulcs érték JSONL fájlban      | nincs                              | saját README zárja ki a több felhasználót                  | nincs                              | **nincs**               | nincs                         | **nincs**                      | saját README zárja ki a milliós adatot   | kizárva a saját dokumentációja alapján  |
| `jexidb` 2.2.1                    | dokumentum fájlban             | nincs                              | "single-writer optimized"                                  | manuális `save()` kötelező         | **nincs**               | nincs                         | **nincs**, nincs `.d.ts` sem   | 179 havi letöltés                        | kizárva: adatvesztés és nincs típus     |
| saját JSONL implementáció         | append only sorok              | nincs                              | egy folyamat                                               | nincs, kézzel `fsync`              | **nincs**               | kézzel                        | **nincs**                      | mi tartanánk karban                      | kizárva, lásd 7.3                       |

### 6.1 A mért fej fej mellett: SQLite kontra PGlite

Ugyanaz a séma, ugyanazok a valós payloadok, ugyanaz a 200 000 sor, ugyanaz a gép.

| Mérés                       | `better-sqlite3` 13.0.3 | `node:sqlite` | PGlite 0.5.8 | Arány                 |
| --------------------------- | ----------------------- | ------------- | ------------ | --------------------- |
| beszúrás, sor per másodperc | **177 462**             | 119 976       | 6 786        | 26x az SQLite javára  |
| 200 000 sor tárhely         | **136,3 MiB**           | 136,2 MiB     | 384,9 MiB    | 2,8x az SQLite javára |
| bájt per sor                | **714 B**               | 714 B         | 2 018 B      | ugyanaz               |
| első lap (200 sor) olvasása | 0 ms                    | 0 ms          | 3 ms         | SQLite javára         |
| indulás (initdb és boot)    | ezredmásodperc alatt    | ugyanaz       | 1 028 ms     | SQLite javára         |
| API alak                    | szinkron                | szinkron      | aszinkron    | tervezési különbség   |

**A PGlite mérés korlátja, kimondva.** A beszúrás soronkénti `INSERT` utat mért, egyetlen tranzakción belül. Többsoros `INSERT` vagy `COPY` utat nem mértünk, és az gyorsabb lenne. Ugyanakkor a mi terhelésünk természete valóban soronkénti hozzáfűzés: a `run_event` sorok élő stream közben, egyesével keletkeznek, tehát a mért út a realisztikus út, nem a legrosszabb eset kitalálása.

**Egy megfigyelés, amit nem mértünk végig.** A PGlite `select version()` kimenete `wasm32-unknown-emscripten, 32-bit`. Ez elvben 32 bites címteret jelent, aminek méretkorlát következménye lehet, de a hivatalos doksi Node FS módra nem ad számot, és mi sem mértük. Nyitott kérdés marad, lásd 8. szekció.

## 7. Ajánlás

### 7.1 Az ajánlás

**Marad az SQLite, `better-sqlite3` driverrel, a SPEC-003 jelenlegi tervével. Sem másik motorra váltani, sem második, fájl alapú motort beépíteni nem indokolt.**

Az indoklás öt mért vagy hivatkozott ponton áll:

1. **A teljesítmény nem szűk keresztmetszet.** 177 462 sor per másodperc beszúrás, 0,5 ms teljes transcript kurzoros olvasás egymillió soros táblán, fedő indexből. A megadott terhelés (milliós esemény, ezres futás, tízezres lépés futás) ezen belül van.
2. **A méret nem szűk keresztmetszet.** A legnagyobb forgatókönyv 24,1 GiB, az SQLite határ 17,5 TB. A pillanatkép tárolási szorzója mérve 1,00x.
3. **A használati eset pontosan az, amit az SQLite hivatalosan ajánl.** Egy szerver processz birtokolja a fájlt (SPEC-003 7.4), és az sqlite.org "Server-side database" szekciója ezt így írja le: a kéréseket a szerver sorosítja, tehát az egyidejűség nem probléma.
4. **Egyetlen jelölt sem ad jobb kombinációt.** A kulcs érték motorok (`lmdb`, `classic-level`) elbuknak a relációs szűrésen és rendezésen, ami a futás és lépés futás listánál kötelező. A DuckDB analitikai motor, és a hivatalos doksija kifejezetten óva int a sok kicsi, ciklusban kiadott beszúrástól, ami épp a mi írási mintánk. A fájl alapú tárolók vagy RAM-ba töltenek, vagy manuális mentést követelnek, vagy a saját README-jük zárja ki a célesetet.
5. **A PGlite az egyetlen komoly alternatíva, és mérve rosszabb.** Ami mellette szól: nincs natív bináris, és van hivatalos Drizzle driver. Ami ellene: 26-szor lassabb beszúrás, 2,8-szer nagyobb fájl, aszinkron API, és a forráskódban igazolt négy mutex, ami a `query`, `exec`, `transaction`, `listen` és `syncToFs` hívásokat egyetlen kapcsolatra sorosítja.

### 7.2 Amit viszont érdemes megbeszélni: a valós duplikáció

A felhasználó megérzése egy valós problémára mutat, ami a 4.4 szekció szerint az adatmodellben, nem a motorban van. Két lehetőség, mindkettő **user döntést igényel**, mert a SPEC-003 rögzített döntéseit érintik.

| Lehetőség                                                                                        | Mért haszon                                                                                             | Az ára                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A: tartalom szerint címzett pillanatkép** (a dokumentum hash-e a kulcs, a futás hivatkozik rá) | változatlan workflow 5000 futásánál 391,0 MiB helyett 79,7 KiB, azaz a mért 5000:1 duplikáció megszűnik | a SPEC-003 4.15 kaszkád lánca megtörik: egy megosztott dokumentumot nem szabad elvinni, amíg másik futás hivatkozik rá. Kell hivatkozásszámlálás vagy szemétgyűjtés, és a 3. döntés ("végleges törlés mindennel együtt") kap egy kivételt, amit ki kell mondani a felületen is. |
| **B: a `content_block_delta` események nem perzisztálódnak**, csak a WebSocketre mennek ki       | az esemény tábla a mért darabszám 28,1 százalékára, a nyers bájt 27,3 százalékára esik                  | visszanézéskor a transcript a kész üzenetet mutatja, a gépelés ütemét nem lehet újrajátszani. A SPEC-003 6.2 "az újrajátszható érték szintű, nem bájt szintű" mondata ezt részben már megengedi, de a döntést ki kell mondani.                                                  |

A kettő független, együtt is alkalmazható. Egyik sem igényel motorváltást, és egyik sem szerepel a mai SPEC-003-ban, tehát mindkettő spec módosítás.

### 7.3 Miért nem kell második, fájl alapú motor

A felvetés második fele az volt, hogy "lehetne egy fájl alapú adatbázis motor is beépítve". A mérés szerint ez tiszta veszteség lenne:

- **Nincs mit nyerni.** Amit egy fájl alapú tároló jobban csinálna (nagy blobok külön fájlban), az az sqlite.org saját mérése szerint 100 KB fölött kezdene számítani, a tipikus pillanatképünk pedig 79,7 KiB, tehát a küszöb alatt van, ahol az adatbázisban tárolás a gyorsabb.
- **Két tranzakciós tartomány keletkezne.** A SPEC-003 9.2 `startRun` művelete egy tranzakcióban írja a futást, a pillanatképet és a `run_started` eseményt. Ha a pillanatkép külön fájlba menne, ez az atomicitás megszűnik, és kézzel kellene pótolni, amire a Node nem ad eszközt: a `fs/promises` doksi szó szerint figyelmeztet, hogy a párhuzamos módosítás ugyanazon a fájlon adatsérülést okozhat.
- **A saját implementáció ára nem kicsi.** A féligírt sor felismerésére nincs beépített Node API, a rename atomicitásához a szülő könyvtárat is `fsync`-elni kell, és a 100 százalékos lefedettségi követelmény mellett minden hibaágra tesztet kell írni. Ezt az SQLite-tól ingyen kapjuk.
- **A meglévő fájl alapú csomagok egyike sem alkalmas.** A `@alcalzone/jsonl-db` a teljes tartalmat RAM-ba tölti `open()`-kor (forráskódból igazolva), és nincs benne lapozás. A `jexidb` manuális `save()` hívást követel, és nem szállít típusdefiníciót. A `jsonl-db` (matschik) saját README-je zárja ki a milliós rekordot és a párhuzamos hozzáférést.

**Ahol viszont van helye a fájlnak:** archiválás és kikerülés a forró útról, ha az O-4 megőrzési kérdés valaha eldől. Erre a `hyparquet-writer` és a `rotating-file-stream` szóba jöhet, de ez akkor lesz aktuális, ha van mért adat egy hosszan futó telepítésről. Ma nincs, tehát ma nem építjük be.

### 7.4 Az ajánlás ára, kimondva

| Ár                                                                    | Mit jelent                                                                                                                                                   |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| egyszerre egy író                                                     | a WAL mellett is. A SPEC-003 7.4 egy processzes feltevése miatt ma nem korlát, de ha valaha több szerver processz kellene, az az egész modellt átrajzolja.   |
| natív bináris marad a függőségi fában                                 | `better-sqlite3` prebuild. Igazolva, hogy Node 26.7.0 alatt a `prebuilds/linux-arm64.node` töltődik be forrásfordítás nélkül; macOS arm64-en még nem mértük. |
| a `run_event` tábla korlátlanul nő                                    | mérve kb 700 MiB per millió esemény a jelenlegi sémával. Megőrzési szabály ma nincs (SPEC-003 O-4), és ez a mérés számot ad hozzá, de nem old meg semmit.    |
| a három index 205 B per sor, a sorköltség 29 százaléka                | ez az ár a 0,5 ms-os kurzoros olvasásért. Nem javasoljuk elvenni, mert a WebSocket replay ezen áll.                                                          |
| a pillanatkép duplikáció megmarad, amíg a 7.2 A pont nem születik meg | mérve 5000:1 legrosszabb esetben.                                                                                                                            |

## 8. Amit nem tudunk, és milyen mérés zárná le

| #   | Nyitott kérdés                                                                  | Mi zárná le                                                                                                               |
| --- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| T-1 | Egy valós, többlépéses workflow futás eseményszáma és bájtmennyisége            | az első valós futás után a `run_event` darabszám és `length(payload)` összeg mérése futásonként, futástípusonként         |
| T-2 | A valós node config szövegméret, tehát a valós pillanatkép méret                | az első tíz valódi workflow `run_graph_snapshot.document` hosszának mérése                                                |
| T-3 | A 714 B per sor linearitása 10 millió sor fölött                                | a jelen mérés megismétlése 10 és 50 millió sorral, ugyanezzel a scripttel                                                 |
| T-4 | macOS arm64 viselkedés: `better-sqlite3` prebuild betöltése és a beszúrási ráta | ugyanez a mérés a felhasználó gépén; ez a SPEC-003 O-7 pontját is zárja                                                   |
| T-5 | PGlite valós írási rátája többsoros `INSERT` vagy `COPY` úton                   | a bench script átírása kötegelt beszúrásra, ugyanezen a 200 ezer soron                                                    |
| T-6 | PGlite wasm32 32 bites címterének méretkorlátja Node FS módban                  | növekvő adatbázis mérése összeomlásig vagy 10 GiB-ig, amelyik előbb jön                                                   |
| T-7 | A `content_block_delta` arány más providernél és más modellnél                  | a wire-probe futtatása `claude-subscription` provider ellen, ugyanezzel a kinyerő scripttel                               |
| T-8 | Az SQLite `VACUUM` költsége és haszna a mi mintánkon                            | a mérés szerint 200 ezer soron 3,3 százalék nyereség (142 811 136 helyett 138 100 736 bájt); nagyobb tábláknál nem mértük |
| T-9 | Az `lmdb-js` és a `classic-level` tényleges ráta ezen a terhelésen              | nem mértük, mert a képességtáblázat kizárta őket. Ha a relációs igény valaha eltűnne, ezt meg kellene mérni.              |

**Amit ez a dokumentum nem dönt el.** A 7.2 két lehetősége spec módosítás, és a felhasználó döntése. Addig a SPEC-003 mai alakja érvényes, és a jelen mérés csak számokat ad hozzá, nem ír felül belőle semmit.

## 9. Források

### SQLite

- https://sqlite.org/limits.html
- https://sqlite.org/pgszchng2016.html
- https://sqlite.org/intern-v-extern-blob.html
- https://sqlite.org/wal.html
- https://sqlite.org/whentouse.html
- https://sqlite.org/autoinc.html
- https://github.com/WiseLibs/better-sqlite3
- https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md
- https://registry.npmjs.org/better-sqlite3/latest
- https://nodejs.org/docs/latest-v26.x/api/sqlite.html

### PGlite

- https://registry.npmjs.org/@electric-sql/pglite/latest
- https://pglite.dev/docs/
- https://pglite.dev/docs/filesystems
- https://pglite.dev/docs/multi-tab-worker
- https://pglite.dev/docs/orm-support
- https://orm.drizzle.team/docs/connect-pglite
- https://api.github.com/repos/electric-sql/pglite

### DuckDB

- https://registry.npmjs.org/@duckdb/node-api/latest
- https://duckdb.org/docs/stable/connect/concurrency
- https://duckdb.org/docs/current/data/insert.html
- https://duckdb.org/why_duckdb

### Kulcs érték motorok

- https://registry.npmjs.org/classic-level
- https://github.com/google/leveldb
- https://registry.npmjs.org/rocksdb/latest
- https://registry.npmjs.org/lmdb/latest
- https://api.npmjs.org/downloads/point/last-month/lmdb
- http://www.lmdb.tech/doc/group__mdb.html
- https://registry.npmjs.org/@harperfast/rocksdb-js/latest
- https://github.com/kuzudb/kuzu
- https://registry.npmjs.org/kuzu

### Fájl alapú tárolók és Node

- https://registry.npmjs.org/@alcalzone/jsonl-db/latest
- https://registry.npmjs.org/jexidb
- https://nodejs.org/docs/latest-v26.x/api/fs.html
- https://nodejs.org/docs/latest-v26.x/api/stream.html

### Projekt belső források

- [`../spec/SPEC-003-domain-perzisztencia.md`](../spec/SPEC-003-domain-perzisztencia.md): a séma, a pillanatkép dokumentum és az esemény tábla, amire a mérés épült
- [`2026-08-26-toolchain.md`](2026-08-26-toolchain.md): a rögzített csomagverziók
- [`2026-08-26-spec000-meresi-jegyzokonyv.md`](2026-08-26-spec000-meresi-jegyzokonyv.md): a `tools/wire-probe/artifacts` rögzítésének körülményei
- `tools/wire-probe/artifacts`: a mérés bemenő adata, 341 rögzített HTTP tranzakció
- `node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts` 4484 sor: a `SDKPartialAssistantMessage` boríték alakja
