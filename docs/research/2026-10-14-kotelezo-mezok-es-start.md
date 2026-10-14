# D3: kötelező szöveg mezők és a Start a létrehozáskor

Az F9 D3 munkacsomagjának mérései és igazolásai. Minden lépésnek saját szekciója van; a
T-009-48 (kötelező szöveg mezők) és a T-009-49 (a Start a létrehozáskor) párhuzamosan készül,
a két szekció függetlenül olvasható.

## T-009-49

**Hatókör.** A `POST /api/workflows` kezelője (`apps/server/src/workflow-endpoint/create-workflow.ts`)
a `DatabaseContext.transaction` hívásán belül a `workflows.createWorkflow` után a
`workflows.replaceGraph` műveletet hívja egyetlen Start csomóponttal (SPEC-008 5.8, O-20).
A `packages/protocol` és a `packages/db` forrása nem változik.

### 1. A tranzakció beágyazása (SPEC-008 M-113 újraellenőrzése)

A döntés azon áll, hogy a `createWorkflow` és a `replaceGraph` saját `transaction` hívása egy külső
`transaction` belsejében SAVEPOINT, és a külső visszagörgetés a belső, már felszabadított
munkát is elviszi. Három független forrás és egy saját olvasás:

| Állítás                                                                                                                                 | Forrás                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A tranzakció függvény egy másik tranzakció függvényen belül savepoint lesz, és a nem elkapott hiba a külsőt is visszagörgeti            | `better-sqlite3` hivatalos dokumentáció, `docs/api.md`, `.transaction()` szekció: <https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md>                                                                                    |
| A Drizzle ORM beágyazott tranzakciója savepoint                                                                                         | Drizzle ORM hivatalos dokumentáció, "Transactions": <https://orm.drizzle.team/docs/transactions>                                                                                                                                          |
| Egy `RELEASE`-szel felszabadított belső savepoint munkáját a külső `ROLLBACK` visszavonja                                               | SQLite hivatalos dokumentáció, "Savepoints": <https://sqlite.org/lang_savepoint.html> ("an inner transaction might commit (using the RELEASE command) but then later have its work undone by a ROLLBACK in an outer transaction")         |
| A telepített `better-sqlite3@13.0.3` `wrapTransaction` ága `db.inTransaction` esetén a savepoint hármast használja; a Drizzle ezt hívja | saját olvasás: `lib/methods/transaction.js` (`savepoint`, `release`, `rollbackTo`), és a telepített `drizzle-orm@0.45.2` `better-sqlite3/session.js` `BetterSQLiteSession.transaction` (`client.transaction(...)`, `deferred` viselkedés) |

A repó saját precedense ugyanez a minta (`packages/db/src/human-approval/human-approval-repository.ts`
dokumentációja). A `DatabaseContext.transaction` (`packages/db/src/sqlite-connection/open-database.ts`)
egy `Outcome` hibaágból `TransactionRollback` kivételt dob, ez görgeti vissza a külső tranzakciót.

### 2. A visszagörgetés igazolása szándékos rontással

A bizonyító teszt a valós `better-sqlite3` `:memory:` adatbázison fut, a commitolt migrációkkal,
mock adatbázis nélkül. A hibaágat adó `replaceGraph` a valós `replaceGraph` hívása UTÁN ad hibát,
tehát a csomópont sor ténylegesen kiíródik, mielőtt a visszagörgetésnek el kellene vinnie
(`apps/server/src/workflow-endpoint/create-workflow.spec.ts`, "REGRESSZIÓ: ha a replaceGraph a gráf
kiírása után hibaágat ad..."). A dekorálás mintája a `packages/engine` `racyDatabase` tesztjeié:
a valós `DatabaseContext` egyetlen repository metódusa cserélődik.

A tíz tesztes fájl két szándékos rontással, a `create-workflow.ts` ideiglenes átírásával:

| Rontás                                                                             | Eredmény                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a `database.transaction` hívás kihagyása, a két repository hívás sorban fut        | 1 teszt bukik: a visszagörgetési REGRESSZIÓ teszt (a workflow sor megmarad); 9 zöld                                                                                                            |
| a `replaceGraph` hívás üres csomópont listával (`[]`) a `buildStartNode()` helyett | 3 teszt bukik: "pontosan egy Start csomópont, él nélkül", "a GET olvasó sémán is átmegy" (egy elemű `nodes` lista elvárása), "két egymás utáni létrehozás két különböző azonosítót ad"; 7 zöld |

A javított kódon mind a tíz teszt zöld. A rontások után a fájl az eredeti tartalomra visszaállt.

### 3. A Start és a T-009-48 kötelező szöveg mező szabálya

A T-009-48 a `db` `replaceGraph` hívására írás oldali ellenőrzést tesz a kötelező szöveg mezőkre
(SPEC-008 5.4). A Start csomópont ezen átmegy, két okból:

1. A SPEC-008 5.4 "Melyik mező kötelező" táblázatának `start` sora három mezőt nevez meg:
   `inputFields[].name`, `inputFields[].label`, `inputFields[].valueKind`. A létrehozáskor írt
   Start `inputFields` listája üres (`[]`), tehát nincs elem, ami e három mezőt hordozná.
2. Az `onUnhandledError` szabály kizárólag a `protocol` mentési sémájában áll, a `db`
   `replaceGraph` a `null` értéket elfogadja, mert az O-20 Startja pontosan ezzel az értékkel
   íródik (SPEC-008 5.4, "Miért nem kerül a `db` `replaceGraph` ellenőrzésébe").

A kimondott következmény ugyanott (SPEC-008 5.8): a frissen létrehozott workflow első mentése a
Start `onUnhandledError` mezőjét jelzi, amíg a felhasználó nem választ.

### 4. Az e2e lefedettség előtte és utána

Ez a lépés `apps/web` termékkódot nem érint (`git diff origin/main -- apps/web` üres), és az
`apps/web/package.json` e2e küszöbéhez sem nyúl. Mérés: `rm -rf apps/web/e2e/.nyc_output
apps/web/coverage-e2e`, majd a teljes Playwright futás három, egymás után futtatott szelettel
(`bun x playwright test --shard=1/3`, `2/3`, `3/3`, szelettenként 159, összesen 477 teszt, mind zöld),
végül `bun run coverage:e2e:report` (kilépési kód 0, a meglévő küszöbbel). A darabszámok a `nyc report
--reporter=json-summary` kimenetéből.

| Metrika    | Előtte (a `2026-09-05-e2e-lefedettsegi-kuszob.md` 47. szekciója) | Utána (mért) | Százalék (mért) | Fedetlen darab, előtte -> utána |
| ---------- | ---------------------------------------------------------------- | ------------ | --------------- | ------------------------------- |
| statements | 1682 / 1697                                                      | 1682 / 1697  | 99.11           | 15 -> 15                        |
| branches   | 784 / 795                                                        | 784 / 795    | 98.61           | 11 -> 11                        |
| functions  | 562 / 565                                                        | 562 / 565    | 99.46           | 3 -> 3                          |
| lines      | 1622 / 1637                                                      | 1622 / 1637  | 99.08           | 15 -> 15                        |

A fedetlen tételek száma egyik metrikán sem nőtt. A teszt darabszám a 47. szekció 473 tesztjéhez
képest 477; a különbséget nem ez a lépés adja, mert nem ad hozzá e2e tesztet és az `apps/web`
fájljai változatlanok.

**A 473 -> 477 különbség tételes magyarázata.** A darabszámot a `bun x playwright test --list`
adja (`apps/web` alatt, `Total: N tests in 32 files`), a mért állapotokon, egy ideiglenes
worktree-ben (a `node_modules` a jelen munkafáéra mutat; a lista csak az `e2e/` fájlokat és a
konfigurációt tölti be, böngészőt és szervert nem indít):

| Állapot                                           | `--list` darabszám |
| ------------------------------------------------- | ------------------ |
| `bb3fd06` (a 47. szekció kiváltó `main` commitja) | 436                |
| `95f62db` (PR #19, a 47. szekciót hordozó commit) | 475                |
| `8413882` (PR #20 után, a jelen ág bázisa)        | 477                |
| a jelen ág `HEAD`-je (az `apps/web` változatlan)  | 477                |

- A `95f62db` és a `8413882` között az `apps/web/e2e` alatt egyetlen commit változtatta a teszteket:
  a `0310262` (PR #21), ami két új `test(...)` blokkot adott a `run-view.spec.ts` fájlhoz (a külső
  elválasztó pointer és billentyű tesztje a vízszintes és a függőleges sávban). Ezt a
  `git log 95f62db..8413882 -- apps/web/e2e` (egy commit) és a `git diff --stat` (egy fájl) igazolja.
  Ez a `475 -> 477`.
- A fennmaradó `473 -> 475` a 47. szekció és a commitolt `95f62db` állapot eltérése: a szekció ugyanebben
  a commitban áll, a `--list` ugyanezen a commiton 475 tesztet ad, a szekció pedig 473-at ír. A mérés
  a PR #19 munkafájának melyik köztes állapotán futott, a squash commit történetéből nem állítható
  vissza, ezért ennek az oka **nem ellenőrzött**. A jelen lépés mérése (477) a `--list` darabszámával
  megegyezik.
