# Hibaválasz nyers adatbázis szöveg nélkül, hibanaplózás, ismétlődő és ütköző gráf azonosítók

**Dátum:** 2026-09-27
**Ág:** `claude/gracious-brahmagupta-wyl8y4`
**Környezet:** a konténer alap `node` a PATH-on `v22.22.2` volt (`/opt/node22`), a `nvm` viszont a
prompt által elvárt `v26.7.0`-t is elérhetővé tette (`/opt/nvm/versions/node/v26.7.0`), csak nem
alapértelmezettként. A kilenc kapu végső, teljes futása `v26.7.0` alatt történt (`nvm use 26.7.0`);
ez alatt derült ki, hogy a `packages/core` `Uint8Array.prototype.toBase64()` hívása `v22.22.2` alatt
`TypeError`-t ad (a metódus ott nem létezik), tehát a `v22`/`v26` eltérés nem csak formális
adminisztráció volt. Bun 1.4.0, `better-sqlite3` 13.0.3 (N-API alapon ABI-stabil, ugyanaz a
natív bináris mindkét Node verzió alatt működött, saját méréssel igazolva), valós `:memory:`
SQLite, Vitest 4.1.11.
**Kiváltó ok:** egy független ellenőrzés valódi `apps/server` ellen mérte, hogy egy `500 internal`
válasz törzsében nyers SQLite szöveg áll (`UNIQUE constraint failed: workflow_node.id`), a SPEC-005
8.4 szerint tiltott módon; a szerver a kérések hibáit egyáltalán nem naplózta; a
`workflow_node.id`/`workflow_edge.id` globális elsődleges kulcs sértését a `db` réteg nem
osztályozta.

---

## 1. SQLite tényleges kiterjesztett hibakódja TEXT elsődleges kulcs sértésére (mérve, nem feltételezve)

A feladat kifejezetten tiltotta a `SQLITE_CONSTRAINT_PRIMARYKEY` kontra `SQLITE_CONSTRAINT_UNIQUE`
feltételezését. Saját mérés, `better-sqlite3` 13.0.3, `:memory:` adatbázis, `CREATE TABLE t (id TEXT
PRIMARY KEY)`, majd két azonos `id` beszúrás:

```
code: SQLITE_CONSTRAINT_PRIMARYKEY message: UNIQUE constraint failed: t.id
```

Tehát a TEXT elsődleges kulcs sértése `SQLITE_CONSTRAINT_PRIMARYKEY` kiterjesztett kódot ad, NEM
`SQLITE_CONSTRAINT_UNIQUE`-ot, a driver szöveg viszont (félrevezetően) `UNIQUE constraint failed`
marad. A `describe-transaction-error.ts` `graph_id_conflict` ága ezt a mért kódot ellenőrzi.

---

## 2. Az öt eset mérése, ELŐTTE (a `main` `67c06a2` állapotán, ideiglenes visszarontással)

A mérés eszköze a repóba került:
`apps/server/src/workflow-endpoint/replace-workflow-graph-error-response.spec.ts`. Az "előtte"
számokhoz a négy érintett termékfájlt (`describe-transaction-error.ts`,
`workflow-graph-document.ts`, `map-outcome-message-to-error-code.ts`, `create-http-server.ts`,
`build-protocol-error-body.ts`) ideiglenesen a `main` állapotára állítottam (`git stash push` a
konkrét fájlokra, a tesztfájlok és az új mérési spec érintetlenül), majd a mérési tesztet egy
átmeneti `console.log` kiegészítéssel futtattam a valódi HTTP kérésekre és a naplóra. A
visszaállítás (`git stash pop`) és a `console.log` eltávolítása után a teszt zöld a fixelt kódon
(4. szekció).

| #   | Eset                                             | Státusz (előtte) | Törzs (előtte)                                                                          | Napló (előtte)                                |
| --- | ------------------------------------------------ | ---------------- | --------------------------------------------------------------------------------------- | --------------------------------------------- |
| a   | két azonos node id egy kérésben                  | **500**          | `{"code":"internal","message":"UNIQUE constraint failed: workflow_node.id"}`            | (nincs napló, a szerver semmit nem naplózott) |
| b   | két azonos él id egy kérésben                    | **500**          | `{"code":"internal","message":"UNIQUE constraint failed: workflow_edge.id"}`            | (nincs napló)                                 |
| c   | node id egy MÁSIK workflow gráfjában már létezik | **500**          | `{"code":"internal","message":"UNIQUE constraint failed: workflow_node.id"}`            | (nincs napló)                                 |
| d   | él id egy MÁSIK workflow gráfjában már létezik   | **500**          | `{"code":"internal","message":"UNIQUE constraint failed: workflow_edge.id"}`            | (nincs napló)                                 |
| e   | nem létező node-ra mutató él                     | 409              | `{"code":"conflict","message":"FOREIGN KEY constraint failed (foreign_key_violation)"}` | (nincs napló)                                 |

**Megfigyelés.** Az (a)-(d) eset mindegyike `500 internal`-t adott, NEM `400`-at vagy `409`-et: a
`workflow_node.id`/`workflow_edge.id` elsődleges kulcs sértését a régi `describeTransactionError`
nem ismerte fel (csak a `SQLITE_CONSTRAINT_FOREIGNKEY`-t), tehát a hibaüzenetben nem volt záró
zárójeles hibaosztály, a `mapOutcomeMessageToErrorCode` pedig minden osztály nélküli üzenetet
`internal`-ra képez. A törzs mind az öt esetben nyers driver szöveget hordozott (az (e) esetben a
`(foreign_key_violation)` osztály mellett is), a SPEC-005 8.4 tiltása ellenére. A szerver egyik
esetben sem naplózott semmit.

---

## 3. A döntések megvalósítása

1. **`graph_id_conflict` a `db` rétegben** (`packages/db/src/sqlite-connection/describe-transaction-error.ts`):
   a `SQLITE_CONSTRAINT_PRIMARYKEY` kódra a driver szöveg végére `(graph_id_conflict)` kerül, ugyanúgy,
   mint a meglévő `foreign_key_violation` ág. Valós `:memory:` SQLite teszt igazolja mindkét irányra
   (node és él) a `workflow-repository.spec.ts`-ben.
2. **Egyediség ellenőrzés a séma szintjén** (`packages/protocol/src/workflow/workflow-graph-document.ts`):
   a `ReplaceGraphRequestSchema` `superRefine`-nal elutasítja, ha két node vagy két él azonosítója
   egyezik egy kérésen belül, a második előfordulás mező útvonalával (`nodes.<i>.id` / `edges.<i>.id`),
   adatbázis hívás nélkül. A node és az él azonosító külön névtér.
3. **`graph_id_conflict` -> `conflict` (409)** (`apps/server/src/error-mapping/map-outcome-message-to-error-code.ts`):
   a `CONFLICT_ERROR_CLASSES` szótár bővül; az osztály NEM kerül a `ProtocolErrorClass` zárt
   szótárába (SPEC-005 8.5), tehát a törzsben nincs `errorClass` mező.
4. **Saját mondat, a driver szöveg csak a naplóba** (`apps/server/src/error-mapping/build-protocol-error-body.ts`):
   a `foreign_key_violation` és a `graph_id_conflict` osztály saját, azonosító és driver szöveg
   nélküli mondatot kap; egy valóban OSZTÁLY NÉLKÜLI (záró zárójel nélküli) üzenet a kivétel ág
   meglévő, általános mondatát kapja. Minden más, ma is saját (authored) mondatú hibaosztály
   (`database_closed`, `no_default_provider`, ...) üzenete változatlan.
5. **Hibanaplózás** (`apps/server/src/http-server/create-http-server.ts`): a `HttpServerOptions`
   `logger` mezőt kapott (`continue-startup-with-database.ts` átvezeti a már meglévő, valódi pino
   loggert). Kérésenként `crypto.randomUUID()` request id, gyermek logger
   `serverInstanceId`+`requestId`+(a hibaágon) `routeId` kontextussal. Az `internal` kódra képződő
   válasz `error`, a `conflict`/`unprocessable` kódra képződő `warn` szinten naplózódik, az EREDETI
   (nem sanitizált) `Outcome` üzenettel; a kivétel ág `error` szinten a kivétellel. A `not_found`,
   `invalid_request`, `service_unavailable` kód ezen a lépésen nem naplózódik (nyitva a SPEC-006
   7.2 többi sorára).

---

## 4. Az öt eset mérése, UTÁNA (a fixelt kódon, a repóbeli teszt kimenetéből)

| #   | Eset                         | Státusz | Törzs                                                                                                             | Napló szint   | Napló `msg` (eredeti Outcome üzenet)                             |
| --- | ---------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------- |
| a   | két azonos node id           | **400** | `{"code":"invalid_request","message":"A kérés törzse érvénytelen, hibás mező(k): nodes.1.id (invalid_request)."}` | (nincs napló) | -                                                                |
| b   | két azonos él id             | **400** | `{"code":"invalid_request","message":"A kérés törzse érvénytelen, hibás mező(k): edges.1.id (invalid_request)."}` | (nincs napló) | -                                                                |
| c   | node id másik workflow-ban   | **409** | `{"code":"conflict","message":"A gráf egy azonosítója már foglalt (graph_id_conflict)."}`                         | **warn** (40) | `UNIQUE constraint failed: workflow_node.id (graph_id_conflict)` |
| d   | él id másik workflow-ban     | **409** | `{"code":"conflict","message":"A gráf egy azonosítója már foglalt (graph_id_conflict)."}`                         | **warn** (40) | `UNIQUE constraint failed: workflow_edge.id (graph_id_conflict)` |
| e   | nem létező node-ra mutató él | **409** | `{"code":"conflict","message":"A kérés nem létező elemre hivatkozik (foreign_key_violation)."}`                   | **warn** (40) | `FOREIGN KEY constraint failed (foreign_key_violation)`          |

Egyik törzsben sincs `constraint failed`, táblanév vagy SQL töredék; a (c) és (d) törzsében nincs
`errorClass` mező (az osztály szándékosan a szótáron kívül marad); a napló sor mindhárom `warn`
esetben tartalmazza a `serverInstanceId`, `requestId` és `routeId` (`replaceWorkflowGraph`)
kontextus mezőt, az eredeti, driver szöveget hordozó `Outcome` üzenettel.

Az (a) és (b) eset a séma szintjén, adatbázis hívás nélkül bukik el (`400`), tehát a `db` réteg
`graph_id_conflict` ágát ezekben az esetekben a séma megelőzi; a (c) és (d) eset az egyetlen út,
ami a `db` réteg új ágát tényleg eléri (a két node/él azonosító MÁSIK workflow-ban ütközik, a séma
ezt nem látja, mert csak az egy kérésen belüli egyediséget ellenőrzi).

---

## 5. Ismert, e lépés hatókörén kívüli megfigyelések (a feladat szerint)

- A szerkesztő új élt hoz létre (React Flow `addEdge`), és a könyvtár élazonosítója elválasztó
  nélkül fűzi össze a végpontokat, tehát elvben azonos azonosítót adhat; a séma ezt mentés előtt,
  mező útvonallal elutasítja (3. döntés). Nem javítás tárgya.
- Egy másik workflow csomópontjára mutató él ma is `200`-at kap, mert az idegen kulcs is globális
  (a `workflow_edge.source_node_id`/`target_node_id` nem szűkíti workflow-ra). Nem javítás tárgya.

---

## 6. Kilenc kapu, végállapot

A kilenc minőségi kapu állását a PR leírása és a `.claude/CLAUDE.md` 12. szekció buktató bejegyzése
tartalmazza; ez a research fájl a mérési adatokra szorítkozik, a `.claude/CLAUDE.md` 15. szekció
"mi nem kerül bele" szabálya szerint.
