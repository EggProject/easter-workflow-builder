# D3: kötelező szöveg mezők és a Start a létrehozáskor

Az F9 D3 munkacsomagjának mérései és igazolásai. Minden lépésnek saját szekciója van; a
T-009-48 (kötelező szöveg mezők) és a T-009-49 (a Start a létrehozáskor) párhuzamosan készül,
a két szekció függetlenül olvasható.

## T-009-48

**Dátum:** 2026-10-14
**Ág:** `feat/spec-008-d3-kotelezo-mezok`, az `origin/main` `8413882` állapotáról
**Környezet:** Node `v26.7.0`, Bun `1.4.0`, `zod@4.4.3` (telepítve), Vitest `4.1.11`, Playwright
chromium a sandbox `LD_LIBRARY_PATH` kerülőjével (`.claude/CLAUDE.md` 12. szekció).
**Hatókör:** SPEC-008 5.4, O-21 (a kötelező szöveg mezők mentéskori elutasítása). Az O-33 (a `join`
negyedik, `mode: null` ága) ebben a lépésben NEM valósult meg, lásd a 4. pontot.

### 1. A mentési séma és a Zod 4 viselkedése, amire épül

A `protocol` mentési sémája (`NodeConfigSaveSchema`) a `NodeConfigSchema.superRefine(...)` alak. Két
tény, a telepített forrásból és saját futtatott tesztből:

- **A `superRefine` nem változtatja a kimeneti típust.** A telepített
  `zod@4.4.3/v4/classic/schemas.js` szerint `superRefine(refinement, params) { return
this.check(superRefine(refinement, params)); }`, tehát ugyanazt a séma osztályt adja vissza egy
  plusz ellenőrzéssel, nem `.transform()`-ot és nem `.default()`-ot. A
  `node-config-save-schema.spec.ts` `expectTypeOf<z.infer<typeof NodeConfigSaveSchema>>()
.toEqualTypeOf<NodeConfig>()` sora ezt a `typecheck` kapun rögzíti.
- **A finomítás alak hibánál nem fut.** A telepített `zod@4.4.3/v4/core/schemas.js` `runChecks`
  függvénye a `when` opció nélküli ellenőrzést kihagyja, ha a bemenet már hibás
  (`util.aborted(payload)`); a `node-config-save-schema.spec.ts` "alak hibánál a kötelező mező
  szabály nem fut" tesztje ezt méri: egy `maxIterations` nélküli `loop` konfig üres
  `continueExpression` mezővel kizárólag a `maxIterations` útvonalú hibát adja.

### 2. A sodródás védelem szándékosan elrontott próbája (99. kritérium, 3. elfogadási pont)

A `db` táblájából ideiglenesen kivett mező (nem commitolt próba, a fájl utána visszaállítva):

```
sed -i "s/  fan_out: \['itemsExpression', 'branchLabelTemplate'\],/  fan_out: ['itemsExpression'],/" \
  packages/db/src/workflow-graph/node-config/required-text-field-paths.ts
flock /tmp/kapu-gep.lock bun run typecheck
```

Eredmény (a wrapper kimenete, kilépési kód `2`):

```
typecheck | 11s
24/25 sikeres, 1 hibas, 20 cache-bol
src/node-config-drift-protection/node-config-drift-protection.spec.ts:150:7 TS2344 Type '{ readonly start: readonly ["inputFields.*.name", "inputFields.*.label", "inputFields.*.valueKind"]; readonly agent_step: readonly ["promptTemplate"]; readonly branch: readonly ["expression", "branches.*.key", "branches.*.label"]; ... 6 more ...; readonly script: readonly [...]; }' does not satisfy the constraint '{ join: { merge: { [x: number]: undefined; [iterator]?: () => ArrayIterator<never>; [unscopables]?: { [x: number]: boolean | undefined; toString: boolean | undefined; ... 30 more ...; with?: boolean; }; ... 29 more ...; toLocaleString?: { ...; }; }; script: { ...; }; ai_synthesis: { ...; }; }; ... 8 more ...; sub_wo...'.
```

A visszaállítás után ugyanez a parancs `25/25 sikeres` eredménnyel zárt.

### 3. Az e2e lefedettség előtte és utána

**Előtte:** a `docs/research/2026-09-05-e2e-lefedettsegi-kuszob.md` 47. szekciójának mérése (a `main`
`95f62db` állapota). A `95f62db` és a kiinduló `8413882` között az `apps/web/src` termékkódja nem
változott (`git diff --stat 95f62db 8413882 -- apps/web/src` kizárólag `.spec.ts` fájlt mutat), tehát
az összes darabszám azonos, a fedett legfeljebb nőhetett.

**Utána:** saját mérés a lépés végső kódján, a 29. szekció tiszta eljárásával: `rm -rf
apps/web/e2e/.nyc_output apps/web/coverage-e2e`, az `apps/web` alatt `bun x playwright test
--shard=1/2` és `--shard=2/2` két egymás utáni hívásban (a sandbox egy hívásban legfeljebb kb. 178
másodpercig fut, és a hívás végén minden indított folyamat leáll, ezért háttérben futtatni nem
lehetett; a lefedettségi fixtúra tesztenként egyedi fájlba ír, tehát a két szelet adata összeadódik),
**477 teszt, mind zöld** (239 + 238), majd `bun run coverage:e2e:report` (exit 0, a meglévő
küszöbbel).

| Metrika    | Előtte fedett / összes (fedetlen) | Utána fedett / összes (fedetlen) |
| ---------- | --------------------------------- | -------------------------------- |
| statements | 1682 / 1697 (15)                  | 1686 / 1701 (15)                 |
| branches   | 784 / 795 (11)                    | 784 / 795 (11)                   |
| functions  | 562 / 565 (3)                     | 562 / 565 (3)                    |
| lines      | 1622 / 1637 (15)                  | 1626 / 1641 (15)                 |

**A fedetlen darabszám egyik metrikán sem nőtt**, és a fedetlen helyek ugyanazon a hat fájlon és
sorszámon állnak, mint a 47. szekcióban (`mount-app.tsx` 16, 21-22; `read-frontend-config.ts` 41,
62, 67, 72, 77; `is-valid-connection.ts` 36; `browser-history-location-port.ts` 21;
`perform-route-request.ts` 89; `use-stream-connection.ts` 202). A négy új, fedett statement és sor a
`run-graph/project-snapshot-graph.ts` csomópontonkénti vetítése. Új, e2e-vel elvileg el nem érhető
sor nem keletkezett.

### 4. Az O-33 negyedik `join` ága: a motor fordítása megbukik (mérve, ezért a lépés itt megállt)

A SPEC-008 5.4 "A join módja: üresen indul" bekezdése a `db` `JoinNodeConfig` uniójába egy negyedik,
`mode: null` tagot vesz fel, és az 1. szekció kimondja, hogy "Az `engine` érintetlen marad". A
`packages/engine` viszont a `db` `NodeConfig` unióját közvetlenül használja
(`run-validation/executable-node-config.ts`: `Exclude<NodeConfig, ScriptNodeConfig |
JoinScriptNodeConfig>`). Ideiglenes próba (nem commitolt): a `db` `node-config.ts` fájlba felvett
`JoinUnselectedNodeConfig` (`type: 'join'`, `mode: null`, `onUnhandledError`) tag után

```
cd packages/engine && bun x tsc --noEmit
src/node-executor/execute-node.ts(37,4): error TS2366: Function lacks ending return statement and return type does not include 'undefined'.
```

A hiba oka a `executeJoinNode` kimerítő `switch (config.mode)` szerkezete, aminek nincs `null` ága.
Futásidőben ugyanez rosszabb: a spec által előírt `isJoinConfig` `case null` ág után egy `mode: null`
`join` átmegy a motor `validateNodeConfigs` lépésén (az a `db` `isNodeConfig` guardját hívja), a
`validateImplementedNodeTypes` is átengedi (`config.mode !== 'script'`), és a végrehajtó diszpécser
`undefined` értéket adna `Promise` helyett. A motor viselkedéséről (melyik hibaosztállyal utasítja el
a futás indításakor) a spec nem dönt, ezért az O-33 része a user döntéséig nyitva marad.

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
