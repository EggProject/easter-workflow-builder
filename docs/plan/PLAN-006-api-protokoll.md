# PLAN-006: Az API és a real time protokoll végrehajtási terve

|               |                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------ |
| Státusz       | tervezet                                                                                         |
| Dátum         | 2026-08-29                                                                                       |
| Spec          | [`../spec/SPEC-005-api-protokoll.md`](../spec/SPEC-005-api-protokoll.md)                         |
| Előzmény spec | [`../spec/SPEC-004-vegrehajto-motor.md`](../spec/SPEC-004-vegrehajto-motor.md)                   |
| Konvenció     | [`../spec/SPEC-002-csomag-architektura.md`](../spec/SPEC-002-csomag-architektura.md), 6. szekció |
| Bontási elv   | [`PLAN-004-csomag-belso-szerkezet.md`](PLAN-004-csomag-belso-szerkezet.md), 3. szekció           |
| Verzióforrás  | [`../research/2026-08-26-toolchain.md`](../research/2026-08-26-toolchain.md)                     |
| Branch        | `feat/spec-005-protokoll`                                                                        |

Ez a terv a SPEC-005-öt végrehajtható, egyenként ellenőrizhető lépésekre bontja. Minden lépéshez tartozik azonosító, egymondatos leírás, függőség, a végrehajtó subagent `model` beállítása és elfogadási kritérium.

## 1. Előfeltételek

| Feltétel             | Elvárt érték                                                     | Ellenőrzés                        |
| -------------------- | ---------------------------------------------------------------- | --------------------------------- |
| Feature branch       | `feat/spec-005-protokoll` a friss `main`-ről                     | `git rev-parse --abbrev-ref HEAD` |
| SPEC-004 lezárva     | a `packages/engine` 18 téma mappája él, a `createEngine` felület | `bun run check:graph`             |
| Node.js              | a toolchain research szerinti verzió                             | `node -v`                         |
| Bun                  | a toolchain research szerinti verzió, csak csomagkezelő          | `bun -v`                          |
| Tiszta munkakönyvtár | nincs uncommitted változás a munka kezdetén                      | `git status --porcelain` üres     |

A `main` védett, közvetlen push tiltott, a zárás PR-rel történik. Az `npm` és az `npx` nem használható, csak `bun run` és `bun x`. A futtatókörnyezet izolált, tehát **pusholni nem lehet**: minden commit sorozat után szólni kell a usernek, a branch nevének megadásával.

**A SPEC-005 két Mermaid rajza a terv írásakor már validálva lett** a valódi `mermaid` csomag (11.17.2) `parse()` hívásával, jsdom DOM mellett. Az 5.1 rajz `flowchart-v2`, az 5.6 rajz `sequence` típusként hibátlanul elemződött, és ugyanaz a futtatás egy szándékosan hibás rajzot kontrollként elutasított. A rajz bármely módosítása után ezt a próbát meg kell ismételni. A `mermaid` csomag **nem** kerül a repóba: a próba a repón kívüli, eldobható munkakönyvtárban fut, hogy a `bun.lock` ne mozduljon.

## 2. A kilenc minőségi kapu

**Minden lépés végén mind a kilenc parancs nulla kilépési kóddal fut, és a lépés csak ezután commitolható.** A kapuk mérvadó listája a `.claude/CLAUDE.md` 8. szekciója.

| Parancs                  | Mit őriz                                                         |
| ------------------------ | ---------------------------------------------------------------- |
| `bun run format:check`   | Prettier formázás                                                |
| `bun run typecheck`      | típushelyesség a teljes workspace-en                             |
| `bun run lint`           | `any`, `as`, `private`, kör, deklarálatlan függőség tilalma      |
| `bun run test`           | Vitest, 100 százalék lefedettség mind a négy metrikán            |
| `bun run build`          | build task                                                       |
| `bun run docs:check`     | `CLAUDE.md` minden kötelező helyen                               |
| `bun run check:casing`   | a git index betűzése egyezik a relatív importokéval              |
| `bun run check:graph`    | aciklikus gráf, szigorúan csökkenő rétegszám                     |
| `bun run check:db-drift` | a `packages/db` séma és a commitolt migrációk szinkronban vannak |

**A kapukat kizárólag a `tooling/scripts` alatti wrappereken keresztül futtatjuk**, a gyökér npm scripttel, nem közvetlenül a `tsc`, `eslint`, `prettier` vagy `vitest` binárissal. Ez a token takarékos wrapper kötelezettség (`.claude/CLAUDE.md` 8.).

Ebből következik a lépések bontásának alapszabálya: **egy lépés soha nem hagy hátra futásidejű sort a hozzá tartozó `.spec.ts` fájl nélkül.** A séma, a belőle következtetett típus, a validáló függvény és a tesztjei ugyanabban a lépésben keletkeznek. A `vitest.config.ts` `coverage.exclude` listája egyetlen sorral sem bővülhet.

Két, erre a csomagra jellemző következmény:

1. **Kimenő oldalon nem validálunk** (SPEC-005 7.4). Egy kimenő séma ellenőrzés olyan hibaágat hozna létre, ami logikailag sosem fut, és a kizárás nélküli küszöb ezt tiltja.
2. **A `ProtocolErrorCode` szótár nem tartalmazhat olyan kódot, amihez nem tartozik előidéző teszteset.** Ha egy kód nem előidézhető, az nem kerül be.

## 3. Modell hozzárendelés

| Modell   | Mikor                                                                                                                                                                                              |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sonnet` | részletes séma leírás alapján végzett kódolás, mezőfelvétel, útvonal tábla, barrel és `CLAUDE.md` írás, grepes invariáns tesztek, dokumentum átvezetés                                             |
| `opus`   | tervezés és olyan kódolás, ahol a megoldást ki kell találni: a Zod és a kilenc lint szabály együttélése, a kurzor és a keret kódolás, a típusszintű sodródás védelem, az adverzariális átvizsgálás |

A `model` mező soha nem hagyható üresen abban a hitben, hogy örököl valamit (gyökér `CLAUDE.md` 6. szekció, MODEL ROUTING).

## 4. Todo lépések

### F1 fázis: az alap, séma tartalom nélkül

Ez a fázis azt dönti el, hogy a Zod egyáltalán együtt tud-e élni a projekt kilenc kapujával. Amíg ez nyitva van, domain séma nem íródik, mert minden további lépés erre épül.

| ID      | Leírás                                                                                                                                                     | Függőség | Modell | Elfogadási kritérium                                                                                                                                                                                                                                                                                                                 |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T-006-1 | Feature branch és kiinduló állapot ellenőrzése, a kilenc kapu lefuttatása a munka kezdete előtt.                                                           | nincs    | sonnet | `git rev-parse --abbrev-ref HEAD` a `feat/spec-005-protokoll` értéket adja, `git status --porcelain` üres, mind a kilenc kapu nulla kilépési kóddal fut a wrappereken keresztül.                                                                                                                                                     |
| T-006-2 | A `zod` felvétele a `packages/protocol` csomagba, plusz egy minimális, eldobható séma, ami mind a kilenc kaput végigfuttatja.                              | T-006-1  | opus   | A `zod` range szó szerint az, amit a fában már meglévő négy csomag és az Agent SDK peer mezője használ, tehát új verziószám nem került a repóba, és a `bun.lock` egyetlen zod verziót tart. A minimális séma `z.strictObject` és `.safeParse()` alakú, `any` és `as` nélkül, `eslint-disable` nélkül. Kilenc kapu zöld. (AC4, AC32)  |
| T-006-3 | `http-route` téma: az `API_BASE_PATH`, a `STREAM_PATH`, a 26 végpont útvonal sablonja és a paraméter behelyettesítő tiszta függvény.                       | T-006-2  | sonnet | A SPEC-005 4.2 táblázatának mind a 26 sorához tartozik sablon, és a darabszámot futtatott teszt igazolja; a `STREAM_PATH` nem kezdődik az `API_BASE_PATH` értékével, erre külön teszt; a behelyettesítő hiányzó és fölös paraméterre egyaránt `Outcome` hibaágat ad. Kilenc kapu zöld. (AC11, AC12, AC18)                            |
| T-006-4 | `protocol-error` téma: a `ProtocolErrorCode` szótár, a `ProtocolErrorBody` séma, a HTTP státusz leképezés, és a Zod hiba lista fordítása a boríték alakra. | T-006-3  | sonnet | Mind az öt kódhoz tartozik státusz és előidéző teszteset; a boríték sémának nincs `stack`, `sql`, `path` és szabad `details` mezője; a Zod hibából épített üzenet a mező **útvonalát** nevezi meg és a kapott értéket nem tartalmazza, erre titkot tartalmazó bemenettel van teszt. Kilenc kapu zöld. (AC10, AC16, AC37, AC38, AC40) |

### F2 fázis: a domain kontraktusok

Ez a fázis a REST felület alakjait adja. Minden téma önállóan tesztelhető, mert a sémák tiszta adatszerkezetek.

| ID      | Leírás                                                                                                                                          | Függőség | Modell | Elfogadási kritérium                                                                                                                                                                                                                                                                                                |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-006-5 | `workflow` téma: a node típus felsorolás, a workflow rekord, a gráf dokumentum, a létrehozás, a módosítás, a teljes gráf csere és a törlés.     | T-006-4  | sonnet | A `DeleteWorkflowRequest` az `acknowledgeIrreversible` mezőn a `true` **literált** követeli meg, és a `false`, a hiányzó mező és a hiányzó törzs mind `invalid_request` hibát ad, három külön tesztesettel; minden bejövő séma `z.strictObject`, ismeretlen kulcsra teszttel. Kilenc kapu zöld. (AC13, AC15)        |
| T-006-6 | `run` téma: a futás és a lépés futás állapot felsorolása, a futás rekord, az indítás, a listázás, a megszakítás, az újraindítás, a pillanatkép. | T-006-5  | sonnet | A `limit` minden listázó sémán **kötelező** mező, `.default()` nélkül; a `RunDetail` hordozza a `persistedStreamDeltas` értéket (SPEC-003 6.6), tehát a visszanéző felület meg tudja mondani, miért nincs delta sor; minden kimenő séma `.readonly()`. Kilenc kapu zöld. (AC14, AC33)                               |
| T-006-7 | `transcript` téma: az esemény `origin` és `kind` felsorolás, a `run_event` drótszintű rekordja, a kurzoros lekérdezés kérése és a lapja.        | T-006-6  | sonnet | A query séma unió, tehát a `stepRunId` és az `afterEventId` együttes küldése `invalid_request`, mindkét ág külön tesztesettel; a `payload` mező `z.unknown()`, nem `any`; a `kind` felsorolás mind a 25 értéket tartalmazza (SPEC-003 6.4). Kilenc kapu zöld. (AC17)                                                |
| T-006-8 | `approval` és `provider` téma: a döntés felsorolás, a várakozó jóváhagyás, a döntés kérés, a provider összefoglaló és a kapcsolat teszt.        | T-006-7  | sonnet | A `PendingApproval` hordozza a `requestedAtMs` értéket; a `ProviderSummary` env változó **nevet** hordoz és nincs olyan mezője, ami értéket vihetne, erre futtatott teszt; a providerekhez nincs írás irányú séma, mert nincs CRUD. Kilenc kapu zöld. (AC9)                                                         |
| T-006-9 | `settings` téma: a beállítás rekord, a részleges frissítés kérése, és a párhuzamossági korlát nézete.                                           | T-006-8  | sonnet | A `SettingsRecord` mindkét mezője kötelező a válaszban, a `PUT` bemenetén mindkettő elhagyható, és a hiányzó mező jelentése a specben kimondott, `.default()` nélkül; a `ConcurrencyLimitView` külön mezőben viszi a beállított korlátot és a mért javaslatot, és a kettő sosem keveredik. Kilenc kapu zöld. (AC14) |

### F3 fázis: az esemény stream

Ez a fázis a spec legkényesebb része: a kurzor szabály és az `id:` sor megléte dönti el, hogy egy szakadás után elvész-e adat.

| ID       | Leírás                                                                                                    | Függőség | Modell | Elfogadási kritérium                                                                                                                                                                                                                                                                                                                                        |
| -------- | --------------------------------------------------------------------------------------------------------- | -------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-006-10 | `event-stream` téma első fele: a stream URL építés, a feliratkozás kérés és állapot, és a kurzor szabály. | T-006-9  | opus   | A csomag **nem** exportál futás azonosítóból stream URL-t építő függvényt, és ezt greppes teszt igazolja; a `SubscriptionRequest` listát vesz, a `PUT` teljes csere, üres és több elemű listára külön teszttel; a `replayLimit` kötelező; a kurzor szabály `max(padló, kurzor)` mindhárom esete külön teszteset. Kilenc kapu zöld. (AC20, AC21, AC24, AC25) |
| T-006-11 | `event-stream` téma második fele: az öt keret sémája diszkriminált unióban, a keret kódoló és a dekódoló. | T-006-10 | opus   | Kizárólag a `run_event` keret kap `id:` sort, mind az öt típusra külön kódolási teszteset a kimenet sorainak összehasonlításával; a törzs mindig pontosan egy `data:` sor, sortörést tartalmazó payloaddal is tesztelve; a dekódoló négy érvénytelen bemenetre `Outcome` hibaágat ad. Kilenc kapu zöld. (AC19, AC22, AC23, AC26, AC27, AC28, AC29)          |

### F4 fázis: sodródás védelem és a csomag zárása

| ID       | Leírás                                                                                                                              | Függőség | Modell | Elfogadási kritérium                                                                                                                                                                                                                                                                                                                                             |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-006-12 | `apps/server`: a drótszintű felsorolások sodródás védelme, megvalósítás nélküli regressziós tesztként, saját téma mappában.         | T-006-11 | opus   | Mind a hat felsoroláshoz tartozik kétirányú, típusszintű kölcsönös értékadhatósági állítás a `db` uniójával; egy szándékosan elrontott érték behelyezése fordítási hibát ad, és ezt futtatott próba igazolja; ahol a `db` futásidejű guardot exportál, a futásidejű ág is fut. A téma mappában nincs futásidejű forrásfájl. Kilenc kapu zöld. (AC34, AC35, AC43) |
| T-006-13 | A csomag zárása: barrel, `package.json`, `CLAUDE.md`, és a placeholder export törlése.                                              | T-006-12 | sonnet | A barrel csak nevesített újraexport, `export *` nélkül, és minden témából a sémát **és** a típust is exportálja; az `IS_PROTOCOL_PLACEHOLDER` megszűnt; a `dependencies` pontosan `core` és `zod`; a `CLAUDE.md` `## Fájlok` táblázata mind a kilenc témát felsorolja. Kilenc kapu zöld. (AC1, AC2, AC3, AC4)                                                    |
| T-006-14 | Greppel ellenőrizhető invariáns tesztek: nincs hálózat, nincs titok mező, nincs szám, nincs `.parse(`, nincs kézi drótszintű típus. | T-006-13 | sonnet | Öt külön invariáns teszt: (1) nincs `node:http`, `fetch`, `EventSource`, `WebSocket`; (2) nincs `Authorization`, süti és token mező; (3) nincs port, időkorlát, lapméret és `retry` szám; (4) nincs `.parse(`, csak `.safeParse(`; (5) nincs `.default()` és `.transform()`. Kilenc kapu zöld. (AC5, AC7, AC8, AC14, AC32)                                       |

### F5 fázis: átvizsgálás és zárás

| ID       | Leírás                                                                                                             | Függőség | Modell | Elfogadási kritérium                                                                                                                                                                                                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------ | -------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-006-15 | Adverzariális átvizsgálás: forrás nélküli szám, kitalált HTTP vagy böngésző viselkedés, megkerülhető szabály.      | T-006-14 | opus   | Az átvizsgálás minden talált forrás nélküli számot eltávolít, és a helyére nyitott kérdés kerül a "mi a viselkedés addig" és a "mi zárná le" mezővel; minden HTTP és böngésző viselkedésre vonatkozó állítás mellett ott a hivatalos forrás; a jelentés megnevezi, mit nem talált. Kilenc kapu zöld. |
| T-006-16 | A SPEC-005 mind a 47 elfogadási kritériumának tételes ellenőrzése, kritériumonként futtatott parancsra hivatkozva. | T-006-15 | opus   | Minden kritérium mellett ott a futtatott parancs vagy a teszt neve; érveléssel teljesítettnek jelentett kritérium nincs; a nem teljesíthető kritérium mellé a blokkoló és a lezáró lépés kerül. (AC44, AC45, AC46)                                                                                   |
| T-006-17 | Commit sorozat, a user értesítése a push szükségességéről, és a szabálykönyv átvezetése.                           | T-006-16 | sonnet | Mind a kilenc kapu zöld a teljes workspace-en; a `.claude/CLAUDE.md` megkapja a Zod eltérés szabályát a forrásával (SPEC-005 7.2), és a `docs/research/2026-08-26-toolchain.md` a `zod` sorát; a user megkapja a branch nevét és a push kérést. (AC41, AC47)                                         |

## 5. Fázis függőségek

| Fázis | Függ ettől | Miért                                                                                           |
| ----- | ---------- | ----------------------------------------------------------------------------------------------- |
| F1    | nincs      | kiindulás, és a Zod együttélésének eldöntése                                                    |
| F2    | F1         | minden domain séma az `http-route` útvonalára és a `protocol-error` boríték alakjára hivatkozik |
| F3    | F2         | a keret sémája a `transcript` téma `run_event` rekordját hordozza                               |
| F4    | F3         | a sodródás védelem az összes felsorolást egyszerre ellenőrzi                                    |
| F5    | F4         | zárás                                                                                           |

A fázisok szigorúan sorosak, egy kivétellel: a T-006-8 párhuzamosítható a T-006-7 lépéssel, mert a `approval` és a `provider` téma nem hivatkozik a `transcript` témára.

## 6. Kockázat kezelés a végrehajtás alatt

| Helyzet                                                                    | Mit teszünk                                                                                                                                                                                                 |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A Zod típusai megbuktatják a `no-unsafe-*` szabályokat (T-006-2)           | a lépés nem zárható le `eslint-disable` sorral. Vagy a séma írás alakja változik, vagy a probléma nyitott kérdésként a specbe kerül, a blokkoló megnevezésével. Szabályt nem lazítunk a Zod kedvéért.       |
| A `zod` fában lévő verziója nem alkalmas                                   | a frissítés **külön, forrásolt lépés**: élő registry lekérdezés két független forrással, és a `docs/research/2026-08-26-toolchain.md` átvezetése. A jelen terv keretében verziót nem emelünk.               |
| Egy séma `.default()` értéket kívánna                                      | a mező kötelező lesz, vagy elhagyható marad kimondott jelentéssel. Szállított alapérték nem kerül a protokollba, mert arra forrás kell.                                                                     |
| Egy végpont olyan repository metódust kívánna, ami nem létezik             | a végpont kimarad, és a hiány nyitott kérdésként a specbe kerül. A `db` felületét ez a terv nem bővíti.                                                                                                     |
| A típusszintű sodródás védelem nem fordul le (T-006-12)                    | a hibás eset teszttel rögzül, majd javítjuk. Ha a `db` uniója és a protokoll felsorolása tényleg eltér, a **protokollt** igazítjuk, mert a `db` a domain forrása.                                           |
| Az `apps/server` csomagnak nincs `vitest` függősége a regressziós teszthez | a `devDependencies` a katalógus hivatkozással bővül, ahogy minden más csomagnál; a `package.json` `test` scriptje nem szükséges, mert a gyökér `vitest.config.ts` az `apps/*` mintát projektként veszi fel. |
| Egy lépés után a lefedettség 100 százalék alá esne                         | a lépés nem zárható le. A hiányzó teszt ugyanabban a lépésben íródik, a `coverage.exclude` lista **nem** bővül.                                                                                             |
| A Mermaid rajz módosul a végrehajtás alatt                                 | a `mermaid` csomag `parse()` hívásával újra kell validálni, jsdom DOM mellett, a repón kívüli munkakönyvtárban, szándékosan hibás rajzzal mint kontrollal. Nem validált rajz nem commitolható.              |
| Egy állítás HTTP vagy böngésző viselkedésről forrás nélkül maradna         | az állítás nem hangzik el, vagy kifejezetten "nem ellenőrzött" jelöléssel megy ki. A SPEC-005 2. szekció F-1 ... F-24 táblázata a bizonyíték, és amit az nem fed, az a 11. szekcióba kerül.                 |
| A wrapper kimenete nem elég a hiba megértéséhez                            | a wrapper által megnevezett `.turbo/wrapper-logs/` fájlt olvassuk, nem a nyers binárist futtatjuk. A kapukat kizárólag a wrappereken keresztül hívjuk.                                                      |

## 7. Definition of Done

1. A `packages/protocol/src` alatt pontosan kilenc téma mappa áll, egy szint mélyen, az `index.ts` barrelen kívül egyetlen fájl sem áll közvetlenül a `src/` alatt, és egyetlen téma mappában sincs alkönyvtár (T-006-3 ... T-006-13).
2. A `packages/protocol/CLAUDE.md` a csomag gyökerében áll, sehol máshol, és a `## Fájlok` táblázata mind a kilenc témát felsorolja; a `bun run docs:check` zöld (T-006-13).
3. Az `IS_PROTOCOL_PLACEHOLDER` export megszűnt, és a barrel csak nevesített újraexportot tartalmaz, minden témából a sémát és a típust is (T-006-13).
4. A `packages/protocol` `dependencies` mezője pontosan `@easter-workflow-builder/core` és `zod`; a `zod` range szó szerint az, amit a fa már használ, tehát új verziószám nem került a repóba, és a `bun run check:graph` zöld a `protocol` L1 besorolásával (T-006-2, T-006-13).
5. A `packages/protocol/src` alatt nincs `node:http`, `fetch`, `EventSource` és `WebSocket` szöveg, és a `package.json` nem listáz HTTP könyvtárat; a csomag egyetlen tesztje sem nyit hálózatot és nem hív valós API-t (T-006-14).
6. A `packages/protocol/src` alatt nincs `@easter-workflow-builder/db` és nincs `@easter-workflow-builder/engine` import (T-006-13, T-006-14).
7. A protokollban nincs `Authorization` fejléc, nincs süti, nincs token mező és nincs bejelentkezési végpont; a `127.0.0.1` bind az egyetlen védelem, és a spec ezt kimondja (T-006-14).
8. A `packages/protocol/src` alatt nincs port, időkorlát, lapméret és `retry` szám (T-006-14).
9. A SPEC-005 4.2 táblázatának mind a 26 végpontjához tartozik útvonal sablon, kérés és válasz séma, és a darabszámot futtatott teszt igazolja (T-006-3 ... T-006-9).
10. Az `API_BASE_PATH` értéke `/api`, a `STREAM_PATH` nem kezdődik vele, és ennek indoka a két Vite issue hivatkozásával a specben áll (T-006-3).
11. A `DeleteWorkflowRequest` az `acknowledgeIrreversible` mezőn a `true` literált követeli meg, tehát a `false`, a hiányzó mező és a hiányzó törzs mind `invalid_request` (T-006-5).
12. A 14. végpont query sémája unió, tehát a `stepRunId` és az `afterEventId` együtt nem küldhető (T-006-7).
13. Öt SSE esemény típus van, `z.discriminatedUnion` az `event` mezőn, és kizárólag a `run_event` keret kap `id:` sort, aminek az értéke a `run_event.id` decimális alakja (T-006-11).
14. A keret törzse mindig pontosan egy `data:` sor, sortörést tartalmazó payloaddal is (T-006-11).
15. A `replay_complete` keret futásonként megy ki, nulla pótolt esemény esetén is, `throughEventId: null` értékkel (T-006-11).
16. A `run_event` keret `delivery` mezője kötelező, `replayed` vagy `live` értékkel; a `run_event_transient` keretnek nincs `delivery` és nincs `id` mezője (T-006-11).
17. A kurzor szabály `max(padló, kurzor)` alakú tiszta függvény, mind a három esetére külön teszttel; a `replayLimit` kötelező mező, alapérték nélkül (T-006-10).
18. A csomag nem exportál futás azonosítóból stream URL-t építő függvényt, és a `SubscriptionRequest` listát vesz, teljes cserével (T-006-10).
19. Minden drótszintű alak Zod sémából származik, a típusa `z.infer` eredménye, és kézzel írt típusdefiníció egyetlen drótszintű alakhoz sem tartozik (T-006-5 ... T-006-11, T-006-14).
20. A csomagban nincs `.parse(` hívás, csak `.safeParse(`, és minden validáló függvény `Outcome<T>` értéket ad (T-006-14).
21. A protokoll egyetlen sémájában sincs `.default()` és `.transform()`, tehát a `z.input` és a `z.output` típus minden sémára megegyezik (T-006-14).
22. Minden bejövő objektum séma `z.strictObject`, minden kimenő séma `.readonly()` (T-006-5 ... T-006-9).
23. A hat drótszintű felsoroláshoz tartozik kétirányú, típusszintű kölcsönös értékadhatósági regressziós teszt az `apps/server` csomagban, amit a `typecheck` kapu érvényesít, és egy szándékosan elrontott érték fordítási hibát ad (T-006-12).
24. Ahol a `db` futásidejű guardot exportál, az `apps/server` regressziós tesztje a protokoll minden felsorolt értékét átengedi rajta (T-006-12).
25. Az `apps/server` sodródás védelmi téma mappájában nincs futásidejű forrásfájl, tehát a lefedettségi mérleget nem érinti (T-006-12).
26. A `ProtocolErrorCode` öt értékű zárt szótár, mindegyikhez pontosan egy HTTP státusz, és mindegyikhez előidéző teszteset (T-006-4).
27. Ugyanaz a `ProtocolErrorBody` alak áll a REST hibaválaszban és a `protocol_error` SSE keretben; a boríték sémának nincs `stack`, `sql`, `path` és szabad `details` mezője (T-006-4, T-006-11).
28. A séma hiba üzenete a hibás mező útvonalát nevezi meg és a kapott értéket soha nem tartalmazza; erre titkot tartalmazó törzzsel van teszt (T-006-4).
29. A `ProviderSummary` env változó nevet hordoz, és nincs olyan mezője, ami env változó értéket vagy API kulcsot vihetne (T-006-8).
30. A SPEC-005 két Mermaid rajza a valódi `mermaid` csomag `parse()` hívásával validált, kontroll rajzzal együtt, és a `mermaid` csomag nem került a repóba (T-006-1, T-006-16).
31. A SPEC-005 11. szekció mind a hét nyitott kérdése nyitottként áll, a "mi a viselkedés addig" és a "mi zárná le" mezővel kitöltve; tippeléssel lezárt pont nincs (T-006-15, T-006-16).
32. Az adverzariális átvizsgálás nem talált forrás nélküli számot, kitalált HTTP vagy böngésző viselkedést, sem megkerülhető szabályt; ahol talált, az javítva vagy nyitott kérdésként jelölve (T-006-15).
33. A SPEC-005 mind a 47 elfogadási kritériuma teljesül, kritériumonként futtatott parancsra vagy tesztre hivatkozva (T-006-16).
34. A `.claude/CLAUDE.md` megkapta a Zod eltérés szabályát a forrásával, és a `docs/research/2026-08-26-toolchain.md` a `zod` sorát (T-006-17).
35. Mind a kilenc minőségi kapu nulla kilépési kóddal fut a teljes workspace-en, kizárólag a `tooling/scripts` wrappereken keresztül, és a lefedettség mind a négy metrikán 100 százalék, kizárás bővítése nélkül (T-006-17).
36. A munka commitolva van a `feat/spec-005-protokoll` branchen, és a user értesítve a push szükségességéről, a branch nevének megadásával (T-006-17).
