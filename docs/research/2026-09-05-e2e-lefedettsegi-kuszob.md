# E2E lefedettségi küszöb: mérés, kizárási döntés, származtatás

**Dátum:** 2026-09-05
**Ág:** `feat/spec-007-frontend`
**Környezet:** chromium (`@playwright/test` 1.62.1), `nyc` 18.0.0, `vite-plugin-istanbul` 9.0.1,
`apps/web` preview build `VITE_COVERAGE=true` mellett, Node 26.7.0
**Kiváltó ok:** felhasználói döntés. Az e2e lefedettségi riportra addig nem volt küszöb
(SPEC-001 10. szekció 4. pont), a felhasználó viszont küszöböt kért, elfogadva, hogy az érték
nem 100 százalék, és hogy tesztelhetetlen részek kimaradjanak.

---

## 1. A kiindulási mérés (a jelen munkamenet változtatásai ELŐTT)

35 Playwright teszt, `bun run test:e2e`, majd `bun run coverage:e2e:report`.

| Metrika    | Fedett / összes | Százalék  |
| ---------- | --------------- | --------- |
| statements | 353 / 403       | **87.59** |
| branches   | 143 / 179       | **79.89** |
| functions  | 117 / 131       | **89.31** |
| lines      | 344 / 393       | **87.53** |

---

## 2. A nem fedett részek tételes szétválasztása

A vizsgálat fájlonként, `nyc --reporter=json` kimenetből, `statementMap` / `branchMap` /
`fnMap` szerint készült, nem a szöveges táblázat "Uncovered Line #s" oszlopából.

### 2.1 Ami e2e-vel tesztelhető volt, csak nem volt rá teszt

| Fájl                                     | Mi hiányzott                                                    | Új teszt                                                                                    |
| ---------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `not-found-route/not-found-route.tsx`    | a teljes fájl (0 százalék)                                      | ismeretlen útvonal, plusz a "Vissza a workflow listára" gomb                                |
| `app-shell/app-shell.tsx`                | a topnav "Workflow-k" link kezelője, és a `case undefined` ág   | topnav link kattintás, ismeretlen útvonal                                                   |
| `history-navigation/use-client-route.ts` | a `popstate` feliratkozás törzse                                | `page.goBack()`                                                                             |
| `protocol-error-message/`                | öt kódból négy (`internal` kivételével)                         | négy mockolt hibaválasz, kódonként                                                          |
| `rest-client/perform-route-request.ts`   | 204, hibás JSON, hibás hiba-törzs, elérhetetlen szerver, séma   | `route.abort()`, nem JSON törzs, `{}` 500-zal, 204, hibás alakú lista                       |
| `rest-client/array-schema.ts`            | nem tömb válasz, és hibás alakú elem                            | `{}` illetve `[{}]` válasz a lista végponton                                                |
| `stream-client/use-stream-connection.ts` | sérült JSON keret, ismeretlen alakú keret, azonos szerver azon. | három új SSE teszt `page.route()` mockon                                                    |
| `stream-client/use-stream-connection.ts` | a `replaying` fázis és a `replay_complete` halmazkezelése       | két új teszt a VALÓDI teszt szerveren, lásd a 4. szekciót                                   |
| `workflow-list/*`                        | kitöltött leírás, provider nélküli létrehozás, env név lista    | négy új modális teszt                                                                       |
| `workflow-list/*`, `run-history/*`       | mind az öt hibaág (létrehozás, átnevezés, összegzés, törlés)    | öt új hibateszt                                                                             |
| `run-history/run-history-screen.tsx`     | a lista betöltési hibaág, és a rendezés `value` akcesszorai     | hibás `listRuns`, "Állapot" fejléc kattintás, "Műveletek" (nem rendezhető) fejléc kattintás |
| `workflow-list/workflow-list-screen.tsx` | a futás indítás hibaága, és a rendezés `value` akcesszorai      | hibás `startRun`, "Név" és "Műveletek" fejléc kattintás                                     |

Összesen **33 új e2e teszt** (35 -> 68).

### 2.2 Ami e2e-vel elvileg sem tesztelhető

Tételesen, fájlonként, indokkal. Ez a lista adja a küszöb és a 100 százalék közti rést.

| Fájl                                                  | Nem fedett                       | Miért nem érhető el e2e-vel                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app-mount/mount-app.tsx`                             | 16. sor, 21-22. sor, 15/20. ágak | Az `index.html` MINDIG tartalmazza a `#root` elemet, tehát a hiányára írt ág nem érhető el. A konfigurációs hibaág pedig a `VITE_*` változók hiányát kezeli, azok viszont **build időben** égnek a bundle-be (`playwright.config.ts` `webServer.env`): egy második, hibás konfigurációval készült build kellene hozzá |
| `frontend-config/read-frontend-config.ts`             | 18, 24, 32, 36, 57, 62, 67. sor  | Ugyanaz az ok: mind a hét sor a hiányzó vagy értelmezhetetlen `VITE_*` változó ága, a változók pedig build időben rögzülnek. A boldog út (a fájl fedett 72 százaléka) minden e2e teszt indulásakor lefut                                                                                                              |
| `history-navigation/browser-history-location-port.ts` | 21. sor                          | A `popstate` feliratkozás LEBONTÁSA, ami React `useEffect` cleanupként fut. Az alkalmazás gyökere a böngészőben soha nem szerelődik le: a lapváltás a teljes dokumentumot dobja el, cleanup nélkül                                                                                                                    |
| `stream-client/use-stream-connection.ts`              | 177. sor                         | Ugyanez: az `EventSource` bezárása a `useEffect` cleanupjában, ami csak leszereléskor fut                                                                                                                                                                                                                             |
| `rest-client/perform-route-request.ts`                | 70. sor                          | A `buildRoutePath` hibaága, ami hiányzó útvonal paraméterre lép. A felület minden hívása betöltött rekordból veszi az azonosítót, tehát nincs olyan felhasználói út, ami hiányzó paramétert produkálna                                                                                                                |

Mind az öt tétel **unit teszttel fedett**, tehát nem tesztelettlen kód: a `packages` és `apps`
unit lefedettsége változatlanul 100 százalék, kizárás nélkül.

---

## 3. A kizárási döntés: NULLA fájl kizárás

A felhasználó megengedte a tesztelhetetlen fájlok kizárását. A mérés szerint viszont **egyetlen
olyan fájl sincs, ami egészében tesztelhetetlen lenne**: a fenti öt fájl mindegyikének van
e2e-ben ténylegesen lefutó boldog útja (a `read-frontend-config.ts` 72 százaléka, a
`mount-app.tsx` 62.5 százaléka, a másik három 85 százalék fölött).

Az `nyc` a kizárást **fájl granularitáson** ismeri (`--exclude` glob mintákkal); soron belüli
kizárásra csak forrásba írt `istanbul ignore` komment volna, ami a termékkódot szennyezné. Egy
fájl kizárása tehát a lefedett boldog utat is kivenné a nevezőből, vagyis **többet zárna ki,
mint amit meg lehet indokolni**.

**Döntés: nincs kizárás.** A `--check-coverage` a teljes `apps/web/src` fára vonatkozik, és a
küszöb nyeli el a tesztelhetetlen maradékot. A maradék pontosan a 2.2 táblázat, tételesen.

---

## 4. Új, mért megállapítás: a `page.route()` HARMADIK korlátja

A `docs/research/2026-08-30-sse-mockolas-meres.md` két esetet zárt le, amiben a `page.route()`
mérten nem alkalmas (`Last-Event-ID` fejléc, menet közbeni keret beszúrás). A jelen mérés egy
harmadikat talált:

**Bármely állítás, aminek a kapcsolat NYITVA maradása az előfeltétele, `page.route()` mockon nem
figyelhető meg.** A `route.fulfill()` lezárt HTTP válasz: a keretek feldolgozása után az
`EventSource` azonnal `error` eseményt kap, a `readyState` kiesik `OPEN`-ből, és a
`computePhase` a `reconnecting` ágra fut. A `replaying` fázis ("előzmények betöltése" felirat) így
csak egy meg nem figyelhető pillanatra jelenik meg.

**Mérés.** Két teszt, ami feliratkozásos `stream_ready` keretet küld `route.fulfill()`-lel, és a
felirat láthatóságát állítja: mindkettő `element(s) not found` hibával, 5000 ms assertion
timeout után bukott el. Ugyanaz a két teszt egy `node:http` teszt szerveren, ami a kapcsolatot
nyitva hagyja, elsőre zölden fut le. Ezt a szemre is látható végállapot igazolja: a korábbi
képernyőképeken a topnav státusz felirata "újracsatlakozás" volt, nem "élő".

**Következmény.** A `sse-reconnect.spec.ts` `sse-real-server.spec.ts` névre változott (`git mv`),
és mind a három kivétel ott áll. A fájl `test.describe.configure({ mode: 'serial' })` beállítást
kapott, mert a teszt szerver a build időben rögzített `VITE_API_ORIGIN` portjára kötődik, amit
egyszerre csak egy teszt tarthat; a `fullyParallel` a fájlon belül is párhuzamosítana. A
`server.close()` mellé `server.closeAllConnections()` is kell, különben a nyitva hagyott SSE
kapcsolat életben tartja a szervert, és a következő teszt `EADDRINUSE`-szal bukna.

---

## 5. A küszöb utáni mérés és a küszöb származtatása

68 Playwright teszt, tiszta `apps/web/e2e/.nyc_output` könyvtárból újragyűjtve.

| Metrika    | Fedett / összes | Százalék  | Előtte |
| ---------- | --------------- | --------- | ------ |
| statements | 398 / 411       | **96.83** | 87.59  |
| branches   | 173 / 184       | **94.02** | 79.89  |
| functions  | 128 / 131       | **97.7**  | 89.31  |
| lines      | 388 / 401       | **96.75** | 87.53  |

**A küszöb pontosan ez a négy szám, felfelé kerekítés nélkül.** Ez ratchet: a lefedettség
nőhet, csökkenni észrevétlenül nem tud.

**Pontosítás (user döntés 2026-09-09, lásd 15. szekció):** a ratchet valójában a fedetlen sorok
SZÁMÁRA vonatkozik, nem a százalékra. A cél az észrevétlen romlás kizárása, nem a százalék
mindenáron való emelkedése. Ha egy változtatás fedett kódot töröl (a nevező zsugorodik), és a
fedetlen tételek darabszáma egyetlen metrikán sem nő, a százalék emiatti csökkenése nem számít
lefedettség-romlásnak: a küszöb ilyenkor lefelé követheti a mért értéket, kizárólag tételes
levezetéssel (melyik fájlból mennyi fedett kód tűnt el, és a fedetlen tételek darabszáma előtte
és utána azonos). Ha a fedetlen sorok száma nő, az valódi romlás: tesztet kell írni, a küszöböt
nem szabad csökkenteni. Ez utóbbi tiltás a szabály eredeti, szigorú olvasata, és változatlanul
érvényes.

A számok nem a szöveges táblázatból, hanem a `--reporter=json-summary` gépi kimenetének `pct`
mezőiből származnak. Az `istanbul-lib-coverage` `percent()` függvénye két tizedesre **lefelé**
kerekít (`Math.floor(tmp / 10) / 100`), tehát a kiírt érték a tényleges `pct` érték, nem
felkerekített változata - enélkül egy 96.8253-as tényleges érték a 96.83-as küszöb alatt lenne, és
a kapu azonnal bukna.

---

## 6. A kikényszerítés mechanizmusa

Forrás: `nyc` 18.0.0 telepített kódja, `lib/commands/report.js` és `index.js`; ugyanaz a fájl
tartalom két független npm tükörről (`unpkg.com`, `cdn.jsdelivr.net`) bájtra egyezik a
telepítettel.

| Kérdés                        | Válasz                                                                                                                            |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Kell-e külön alparancs        | Nem. A `report` handlere a riport UTÁN hívja ugyanazt a `checkCoverage()` metódust, ha a `--check-coverage` flag be van kapcsolva |
| Milyen kilépési kód           | `process.exitCode = 1` (nem azonnali `process.exit`)                                                                              |
| Melyik csatorna               | `console.error`, tehát **stderr** - pontosan az, amit a wrapper szerződése megkövetel                                             |
| Az összehasonlítás            | `if (coverage < thresholds[key])`, tehát a küszöbbel **egyenlő** érték átmegy                                                     |
| A `--temp-dir` érvényes-e itt | Igen, az `@istanbuljs/schema` `tempDir.nycCommands` listája a `check-coverage` parancsot is tartalmazza                           |

### Saját, most futtatott igazolás, hogy a kapu tényleg bukik

| Próba                                                                | Eredmény                                                                                      |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| a beállított küszöbbel `bun run coverage:e2e:report`                 | exit **0**                                                                                    |
| `--statements 96.84` (egy századdal a mért érték fölött)             | exit **1**, `ERROR: Coverage for statements (96.83%) does not meet global threshold (96.84%)` |
| a wrapperen át, `--statements 99.99` küszöbbel                       | exit **1**, stdout **0 bájt**, minden diagnosztika stderr-en, a napló útja megnevezve         |
| a CI lépés tényleges törzse (`if ! bun run coverage:e2e:report ...`) | exit **1**                                                                                    |

A lánc harmadik szeme a `.github/workflows/ci.yml` `ci` jobja: a `needs` listája
`[gate, test, build, e2e]`, és a záró lépés `contains(needs.*.result, 'failure')` feltételre
`exit 1`-et ad. Az `e2e` job bukása tehát a `ci` jobot is megbuktatja - ez az egyetlen
státuszcsekk, amit a repository ruleset kötelezőnek kér. A `needs` lista tartalmát regressziós
teszt őrzi (`apps/web/src/e2e-coverage-threshold/`), hogy egy későbbi átszervezés ne tudja
csendben kivenni.

---

## 7. Ami NEM ELLENŐRZÖTT

- **A mérés kizárólag chromium ellen futott.** Az `apps/web/playwright.config.ts` ma csak a
  `chromium` projektet definiálja. Ha a projektlista bővül, a küszöb újramérendő: más motor más
  ágakat futtathat (például a `browser-event-source-factory` körül).
- **A küszöb nem "per-file".** Az `nyc --per-file` kapcsolóját nem kapcsoltuk be, mert az a fenti
  öt, tesztelhetetlen maradékot tartalmazó fájlt azonnal megbuktatná, és fájlonként külön küszöböt
  kellene hozzá kitalálni, amire nincs forrásunk. A globális küszöb ratchet jellege enélkül is
  megvan.

---

## 8. SPEC-008 utólagos kiegészítés (2026-09-06): három új, tételesen igazolt elérhetetlen ág

A gráf szerkesztő (SPEC-008) node-inspector és graph-node-card témái négy korábban hiányzó,
ténylegesen e2e-elérhető branch-et kaptak új Playwright teszttel (`node-inspector.spec.ts`
"nem numerikus backoffMs sor..." teszt, `rest-error-paths.spec.ts` "nem 2xx válaszra, ha a törzs
NEM érvényes JSON..." teszt, `sse-frames.spec.ts` "eltérő serverInstanceId..." teszt,
`client-route-navigation.spec.ts` "/run" útvonal teszt). Eközben egy korábbi jelentés két
állítását saját méréssel kellett ellenőrizni; az egyik hamisnak bizonyult, a másik igaznak. A
maradék, tételesen e2e-vel elvileg sem elérhető ágak az alábbi hárommal bővülnek (a fenti 2.2
táblázat öt tétele mellé, azokat nem érintve):

| Fájl                                   | Nem fedett ág                               | Miért nem érhető el e2e-vel                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `graph-node-card/GraphNodeCard.tsx`    | 74. és 82. sor (`status !== undefined` ág)  | A `data.status` mezőt ma egyetlen hívó sem állítja be (`GraphEditorScreen`/`GraphEditorCanvas` grep-elve: nincs `status:` mező a node adatban) - az élő futás nézet drótba kötése a PLAN-009 F4 ... F6 fázisának tárgya. **Előző jelentés állítása: IGAZ, saját méréssel megerősítve.**                                                                                                                                                                                                                                                                                                                                               |
| `node-inspector/NodeInspector.tsx`     | 123. sor (`path === '' ? '(gyökér)' : ...`) | Gyökér szintű (üres útvonalú) zod hiba csak akkor keletkezik, ha a `config` maga nem objektum, vagy egy `z.strictObject` felesleges kulcsot kap - mindkettőt már a `readWorkflowGraph` válaszát ellenőrző `WorkflowGraphDocumentSchema` (ugyanaz a `NodeConfigSchema`) kiszűri, mielőtt a node elérné a `NodeInspector`-t; a mezőszerkesztők pedig kizárólag `{...config, mező: érték}` szórással módosítanak, sosem cserélik le a teljes `config`-ot. Saját méréssel igazolva (`NodeConfigSchema.safeParse(null\|42\|"x"\|[])` és extra kulcsos objektum, mindkettő `path: []`-t ad, de egyik sem jut túl a wire-szintű validáción). |
| `rest-client/perform-route-request.ts` | 70. sor (`buildRoutePath` hibaág)           | A már dokumentált 2.2 táblázat tétele, a mai gráf szerkesztő útvonalakkal (`workflowId`/`runId` query paraméter) is változatlanul érvényes: minden hívó betöltött rekordból veszi az azonosítót.                                                                                                                                                                                                                                                                                                                                                                                                                                      |

**Az előző jelentés MÁSIK állítása (a `role="alert"` mezőnkénti hibalista, `NodeInspector.tsx`
119-127. sor és `field-errors-from-zod-error.ts`) HAMISNAK bizonyult.** Az `error_handler` node
`backoffMs` mezője (`number-list-field-value.ts`) egy `<textarea>`, NEM natív `type="number"`
input, tehát a böngésző nem szűri ki a nem numerikus sort: a `fromNumberListFieldValue` a
`Number('abc')` NaN eredményét válogatás nélkül a tömbbe teszi, a `NodeConfigSchema.safeParse`
pedig a `z.number()` miatt elutasítja (saját méréssel igazolva:
`z.number().safeParse(NaN)` `invalid_type` hibát ad). Ez a felhasználói úton TÉNYLEGESEN
kiváltható, új Playwright teszt fedi (`node-inspector.spec.ts`), mindkét érintett fájl e2e
branch/statement/function/line lefedettsége ezután 100 százalék.

**Mért állapot ezután (teljes `apps/web/e2e` újrafuttatás, 116 teszt):** statements 97.24,
branches **95.05**, functions 98, lines 97.12 - mind a négy metrika a jelenlegi, VÁLTOZATLANUL
hagyott küszöb fölött. A küszöb emelését (ratchet) a koordinátor dönti el: a mérés időpontjában
egy másik, párhuzamos munkamenet a `graph-editor/` témát élőben szerkesztette, tehát ez a szám a
véglegesnél instabilabb alapot ad egy visszavonhatatlan küszöbemeléshez.

---

## 9. Végleges konszolidációs mérés (2026-09-06): öt párhuzamos ág egyesítése utáni küszöb

Az öt párhuzamos munkamenet lezárult, minden módosítás egyetlen commit sorozatban áll a
`feat/spec-008-grafszerkeszto` ágon. Ez a mérés a végleges állapoton fut: tiszta
`apps/web/e2e/.nyc_output`, `bun run test:e2e` (117 Playwright teszt, mind zöld), majd
`nyc report --reporter=json-summary` a pontos `pct` értékekért.

| Metrika    | Fedett / összes | Százalék  | Előző (7. szekció, instabil alapon) |
| ---------- | --------------- | --------- | ----------------------------------- |
| statements | 890 / 909       | **97.9**  | 97.24                               |
| branches   | 367 / 384       | **95.57** | 95.05                               |
| functions  | 347 / 351       | **98.86** | 98                                  |
| lines      | 852 / 871       | **97.81** | 97.12                               |

**A küszöb ez a négy szám, felfelé kerekítés nélkül** (`apps/web/package.json`
`coverage:e2e:report` scriptje). Az igazolás: a mért értékkel a kapu exit 0, egy 0.01-dal
megemelt `--statements 97.91` kapcsolóval (a `package.json`-t nem érintve, külön `nyc report`
hívással) a kapu `ERROR: Coverage for statements (97.9%) does not meet global threshold
(97.91%)` üzenettel exit 1-et ad - tehát a mechanizmus ténylegesen kikényszerít.

### 9.1 A koordinátori jelentés ellenőrzése a valósággal szemben

A feladatot kiadó jelentés öt fedetlen helyet sorolt fel. A tényleges `nyc`
`coverage-final.json` (`statementMap`/`branchMap` szerint, nem a szöveges "Uncovered Line #s"
oszlopból) ezt **három ponton egészíti ki**: a jelentés hiányos volt, nem téves.

| Fájl                                                             | A jelentésben szerepelt? | Tényleges fedetlen sor/ág                                                                       |
| ---------------------------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------- |
| `app-mount/mount-app.tsx`                                        | igen                     | 16, 21-22. sor (változatlan, lásd 2.2)                                                          |
| `frontend-config/read-frontend-config.ts`                        | igen                     | 23, 29, 37, 41, 62, 67, 72, 77. sor (a sorszámok a 2.2 tábla óta eltolódtak, az ok azonos)      |
| `rest-client/perform-route-request.ts`                           | igen                     | 70. sor (változatlan, lásd 2.2 és 8. szekció)                                                   |
| `stream-client/use-stream-connection.ts`                         | igen (182. sorral)       | 182. sor - a jelentésben megadott sorszám pontosan egyezik a méréssel                           |
| `graph-node-card/GraphNodeCard.tsx` + `step-run-status-badge.ts` | igen                     | 74. és 82. sor (`cond-expr`/`binary-expr`), `step-run-status-badge.ts` 30. sor - egyezik        |
| `node-inspector/NodeInspector.tsx`                               | igen                     | 123. sor (`cond-expr`) - egyezik                                                                |
| `history-navigation/browser-history-location-port.ts`            | **NEM szerepelt**        | 21. sor - ez a 2.2 tábla RÉGI, már dokumentált tétele, a jelentés csak kihagyta a felsorolásból |
| `graph-editor/GraphEditorScreen.tsx`                             | **NEM szerepelt, ÚJ**    | 177-178. sor, plusz a 222. sor JSX feltétel igaz ága                                            |
| `graph-editor/is-valid-connection.ts`                            | **NEM szerepelt, ÚJ**    | 36. sor (`return false`)                                                                        |
| `graph-editor/validate-graph-for-save.ts`                        | **NEM szerepelt, ÚJ**    | 23. sor (`return { kind: 'error', ... }`)                                                       |

A `browser-history-location-port.ts` tétel nem új hiba, csak a koordinátori jelentés nem sorolta
fel újra (a 2.2 táblában már 2026-08-30 óta dokumentált `useEffect` cleanup ág). A három valóban
ÚJ tétel (`GraphEditorScreen.tsx`, `is-valid-connection.ts`, `validate-graph-for-save.ts`) mind a
`graph-editor-validation.spec.ts` fájl saját fejléc kommentjében (2-16. sor) már meg volt
indokolva, csak nem lett átvezetve ebbe a research fájlba.

### 9.2 A három új tétel indoklása és unit teszt fedettsége

**`graph-editor/validate-graph-for-save.ts` 23. sor és `GraphEditorScreen.tsx` 177-178. sor,
plusz a 222. sor JSX feltétel igaz ága - egy gyökérok.** A `validateGraphForSave` hiba ágát
(`ReplaceGraphRequestSchema` elutasítás) a `graph-editor-validation.spec.ts` fejléce (2-16. sor)
szerint szándékosan nem próbálja valódi felhasználói úton előidézni: a `node-config` sémák
egyikében sincs `regex`/`min`/`max`/`positive` korlátozás (saját grep-pel igazolva), az egyetlen
elméleti forrás (egy `NaN` a `maxIterations` számmezőn) pedig a natív `<input type="number">`
böngésző szintű bemenet-tisztítása miatt sosem jut el a React állapotig. Emiatt a
`GraphEditorScreen.handleSave` `validated.kind === 'error'` ága (177-178. sor,
`setValidationMessage` + korai `return`) és az ebből következő `validationMessage !== undefined`
JSX feltétel igaz ága (222. sor, a `<p role="alert">` kiírása) is együtt marad fedetlen: a kettő
ugyanannak az állapotnak a beállítása, illetve a beállított állapot megjelenítése. Unit teszttel
fedve: `validate-graph-for-save.spec.ts` ("hibás node mezőre (NaN egy number mezőn...) error
Outcome-ot ad...") és `GraphEditorScreen.spec.tsx` ("hibás gráfra (NaN a maxIterations mezőn) a
Mentés nem indít kérést, és megnevezi a hibás mezőt (AC12)" - ez utóbbi a `container.textContent`
tartalmazza a `maxIterations` szót, tehát a 222. sor JSX ágát is lefuttatja).

**`graph-editor/is-valid-connection.ts` 36. sor.** Az `isValidGraphConnection` a `return false`
ágat kizárólag akkor adja, ha a cél node katalógus bejegyzése `hasInputHandle: false` (jelenleg
kizárólag a `start` típus). A `GraphNodeCard.tsx` viszont `hasInputHandle && <Handle
type="target" .../>` mintával **egyáltalán nem rajzol** bemenő handle DOM elemet ilyen node-ra
(saját olvasással igazolva, `GraphNodeCard.tsx` 79. sor). A React Flow kapcsolat-húzás
(`onConnect`/`isValidConnection`) csak akkor tüzel, ha az egér egy létező handle DOM elem fölött
enged fel - `start` node esetén ilyen elem nincs a lapon, tehát a húzás React Flow szinten akad
el, mielőtt az `isValidGraphConnection` egyáltalán meghívódna. Ezt maga az e2e teszt
(`graph-editor-validation.spec.ts`, "a bemenő handle nélküli (start) csomópontra irányuló húzás
nem hoz létre élt" teszt, 255-257. sor kommentje: "ide nincs mire csatlakozni") is dokumentálja:
az a teszt a hiányzó élt igazolja, nem magát a `return false` ágat futtatja le. Unit teszttel
fedve: `is-valid-connection.spec.ts` ("elutasítja a start csomópontra kötést, mert nincs bemenő
handle-je").

### 9.3 Igazolás, hogy minden fedetlen e2e sor unit teszttel fedett

A unit lefedettség (`bun run test`) 100 százalék, kizárás nélkül, minden metrikán - ez a 8.
szekció négy kapuja közül a `test` kapu, ami ebben a munkamenetben zöld. Az egyenkénti
megfeleltetés:

| Fedetlen e2e hely                                        | Unit teszt                                                                                         |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `app-mount/mount-app.tsx`                                | a fájl saját `.spec.tsx`-e (VITE_ hiba ágak, build idejű config mock)                              |
| `frontend-config/read-frontend-config.ts`                | `read-frontend-config.spec.ts`                                                                     |
| `graph-editor/GraphEditorScreen.tsx` 177-178, 222        | `GraphEditorScreen.spec.tsx` ("hibás gráfra (NaN a maxIterations mezőn)... (AC12)")                |
| `graph-editor/is-valid-connection.ts` 36                 | `is-valid-connection.spec.ts` ("elutasítja a start csomópontra kötést...")                         |
| `graph-editor/validate-graph-for-save.ts` 23             | `validate-graph-for-save.spec.ts` ("hibás node mezőre (NaN egy number mezőn...)")                  |
| `graph-node-card/GraphNodeCard.tsx` 74, 82               | `GraphNodeCard.spec.tsx` (`it.each(StepRunStatusSchema.options)` a "%s" StepRunStatus badge teszt) |
| `graph-node-card/step-run-status-badge.ts` 30            | `step-run-status-badge.spec.ts`                                                                    |
| `history-navigation/browser-history-location-port.ts` 21 | a fájl saját `.spec.ts`-e (`popstate` feliratkozás lebontás)                                       |
| `node-inspector/NodeInspector.tsx` 123                   | a fájl saját `.spec.tsx`-e (gyökér szintű zod hiba ág, direkt hívással)                            |
| `rest-client/perform-route-request.ts` 70                | `perform-route-request.spec.ts` (`buildRoutePath` hiányzó paraméter ág)                            |
| `stream-client/use-stream-connection.ts` 182             | a fájl saját `.spec.ts`-e (`EventSource` bezárás `useEffect` cleanup)                              |

### 9.4 A `GraphNodeCard.tsx`/`step-run-status-badge.ts` kizárás jövője

A `data.status` mezőt ma egyetlen hívó sem állítja be (`GraphEditorScreen`/`GraphEditorCanvas`
grep-elve nincs `status:` mező a node adat összeállításánál). Az élő futás nézet (a lépés
állapotának valós idejű, WebSocket/SSE eredetű megjelenítése a vásznon) a PLAN-009 F4 ... F6
fázisának tárgya. **Amint ez megvalósul, ez a kizárás megszűnik**: az élő futás nézet e2e tesztje
szükségszerűen beállít egy `status` értéket, és attól kezdve `GraphNodeCard.tsx` 74/82. sora és a
`step-run-status-badge.ts` teljes fájlja e2e-vel is 100 százalékban fedett lesz.

---

## 10. Küszöb emelés (2026-09-06): a node inspector újratervezése után

A node inspector beállítás panel újratervezése (dokkolt, húzható jobb oldali sáv, `fieldset`
helyett `role="group"`, mezőnkénti hibajelzés) új e2e teszteket is hozott, és a lefedettség
mind a négy metrikán NŐTT. A ratchet szabály szerint a küszöb a mért értékre emelkedik.

**A mérés menete:** törölt `apps/web/e2e/.nyc_output` és `apps/web/coverage-e2e`, majd
`bun x turbo run test:e2e --filter=@easter-workflow-builder/web --force` (127 Playwright teszt,
mind zöld), végül `nyc report --reporter=json-summary` a pontos `pct` értékekért.

| Metrika    | Fedett / összes | Százalék  | Előző küszöb (9. szekció) |
| ---------- | --------------- | --------- | ------------------------- |
| statements | 936 / 955       | **98.01** | 97.9                      |
| branches   | 372 / 388       | **95.87** | 95.57                     |
| functions  | 356 / 360       | **98.88** | 98.86                     |
| lines      | 897 / 916       | **97.92** | 97.81                     |

**A `node-inspector` téma minden fájlja 100 százalék mind a négy metrikán.** Az `all files`
maradék rése változatlanul a 2.2 és a 8. szekció tételes listája (`app-mount`,
`frontend-config`, `graph-editor` három fájlja, `graph-node-card` két fájlja,
`history-navigation`, `rest-client`, `stream-client`), plusz a `GraphEditorScreen.tsx` mentés
előtti validáció hibaága, ami a `validate-graph-for-save.ts` fedetlen ágának a párja.

### 10.1 A 9.3 táblázat egy sora TÖRLENDŐ: `node-inspector/NodeInspector.tsx` 123

A korábbi mérés a `NodeInspector.tsx` `path === '' ? '(gyökér)' : path` ágát e2e-vel
elérhetetlenként tartotta nyilván, unit teszttel fedve. **Ez az ág megszűnt.** Az újratervezés
során kiderült, hogy az ág nem csak e2e-vel elérhetetlen, hanem a FELÜLETEN sem állhat elő: a
gyökér szintű `z.strictObject` hibához egy felesleges kulcs kellene a `config` objektumon, a
gráf betöltésekor viszont a `WorkflowGraphDocumentSchema` UGYANEZT a `NodeConfigSchema` sémát
futtatja, tehát egy ilyen dokumentum el sem jut a panelig. A `.claude/CLAUDE.md` 5. szekciója
az ilyen ágat tiltja, ezért a JavaScript elágazás helyére a
`.node-inspector__error-path:empty::before` CSS szabály lépett: a jelölés megmarad, az ág
eltűnt. A `NodeInspector.spec.tsx` továbbra is előállítja a gyökér szintű hibát, és azt
ellenőrzi, hogy az útvonal eleme üres, tehát a CSS szabály illeszkedik rá.

### 10.2 Két új segéd, amit a mérés alakított

A tervezett `scope-field-errors.ts` és `ScopedFieldErrors.tsx` (a `join` `ai_synthesis` módja
alatti `settings.` előtag levágása) **törölve lett**, mert a szűrés ága a felületről nem
érhető el: az `AgentStepConfigSchema` egyetlen mezője sem tud séma szerint érvénytelen értéket
felvenni felhasználói úton (`promptTemplate`, `modelId`, `effort`, `permissionMode`, `cwd`
mind `z.string()`, a listák `z.array(z.string())`, a számok natív `type="number"` mezőn
mennek, a `sandbox` és a `structuredOutput` szerkesztője pedig saját `safeParse` kapun
engedi tovább az értéket). Helyette az `AgentStepConfigFields` kötelező `fieldPathPrefix`
propot kapott (`''` az `agent_step` node-on, `'settings.'` a `join` `ai_synthesis` módjában):
sztring összefűzés, elágazás nélkül, és ugyanazt oldja meg.

A `find-field-error.ts` a `Map.get` gyorsút nélkül, egyetlen bejárással készült el. A gyorsút
ága csak unit tesztből lett volna elérhető, mert a felületen ma **egyetlen** séma szerinti
hibaútvonal reprodukálható: az `error_handler` node `backoffMs` mezőjének nem numerikus sora
(`backoffMs.<index>`, tehát előtag egyezés, nem pontos egyezés). A térkép legfeljebb néhány
elemű, tehát a gyorsút nem mért volna semmit.

### 10.3 Ami NEM ELLENŐRZÖTT ebben a mérésben

A mérés időpontjában a `feat/spec-008-grafszerkeszto` ágon egy párhuzamos munkamenet
(morzsamenü bevezetése) is dolgozott, és a commitjai már az ágon álltak. A fenti négy szám
tehát a KETTŐ EGYÜTTES állapotát méri. Ha a párhuzamos munkamenet később még fedetlen kódot
tesz hozzá, a kapu az ő oldalán bukik, és a lefedettséget nekik kell visszahozniuk a küszöbre;
a küszöb leszállítása ilyenkor is tiltott.

---

## 11. Konszolidációs újramérés (2026-09-06): a két párhuzamos ág egyesítése és a vászon-rés javítása után

A 10.3 pontban jelzett nyitott kérdés lezárva: a morzsamenü munkamenet és a node inspector
munkamenet is lezárult, plusz megtörtént a gráf szerkesztő vászon alatti üres sáv javítása
(`.app-content:has(> .graph-editor-screen)`, `packages/ui/src/topnav-shell/topnav-shell.css`)
és egy hozzá tartozó új e2e teszt (`apps/web/e2e/graph-editor.spec.ts`, a rés mérése
700/900/1200px viewport magasságon).

**A mérés menete:** törölt `apps/web/e2e/.nyc_output`, `bun run test:e2e` (128 Playwright
teszt, mind zöld), majd `nyc report --reporter=json-summary` a pontos `pct` értékekért.

| Metrika    | Fedett / összes | Százalék  | Előző küszöb (10. szekció) |
| ---------- | --------------- | --------- | -------------------------- |
| statements | 936 / 955       | **98.01** | 98.01                      |
| branches   | 372 / 388       | **95.87** | 95.87                      |
| functions  | 356 / 360       | **98.88** | 98.88                      |
| lines      | 897 / 916       | **97.92** | 97.92                      |

**A szám nem változott.** A CSS javítás (topnav-shell.css) és a tooling-szintű keresztszennyeződés
javítás (no-em-dash.spec.ts) egyike sem `apps/web/src` instrumentált forrás, az új e2e teszt pedig
meglévő, már fedett kódutakon mér, tehát sem a számláló, sem a nevező nem mozdult. A
`apps/web/package.json` `coverage:e2e:report` küszöbe (98.01/95.87/98.88/97.92) ezzel a végleges,
konszolidált állapoton igazolt, nem csak a részállapoton - a 10.3 pont nyitott kérdése ezzel
lezárva.

---

## 12. A node inspector belső újratervezése utáni ratchet (2026-09-09)

**Kiváltó ok:** a `node-inspector` téma belső újratervezése (SPEC-008 5.2, felhasználói kérések
2026-09-09): a hibaösszesítő megszűnt, a kártya alakú `InspectorSection` és a `node-inspector`
saját `TextAreaField` fájlja törölve (a `packages/ui` `textarea` témája lépett a helyére), a
mezők pedig összecsukható panelekbe kerültek.

**A mérés menete:** törölt `apps/web/e2e/.nyc_output`, teljes `bun x playwright test` (136
Playwright teszt, mind zöld), majd `nyc report --reporter=json-summary` a pontos `pct`
értékekért.

| Metrika    | Fedett / összes | Százalék  | Előző küszöb (11. szekció) |
| ---------- | --------------- | --------- | -------------------------- |
| statements | 959 / 976       | **98.25** | 98.01                      |
| branches   | 372 / 386       | **96.37** | 95.87                      |
| functions  | 359 / 363       | **98.89** | 98.88                      |
| lines      | 921 / 938       | **98.18** | 97.92                      |

**Mind a négy metrika NŐTT, tehát a ratchet felfelé mozdul**; az `apps/web/package.json`
`coverage:e2e:report` küszöbe a mért értékre áll (98.25/96.37/98.89/98.18).

**Egy közbenső mérés kimondása, mert tanulságos.** Az újratervezés után, az utolsó új e2e teszt
ELŐTT a mérés 97.95/95.59/98.89/97.86 volt, tehát HÁROM metrikán a küszöb ALATT - miközben a
nem fedett sorok száma (20) egyáltalán nem változott. Az ok tisztán a nevező: az újratervezés
több mint 150 sornyi, **száz százalékban fedett** kódot törölt (a saját `TextAreaField.tsx`, az
`InspectorSection` kártya és a hibaösszesítő blokk), tehát a fedett rész zsugorodott, a
változatlan, nem fedett sorok pedig nagyobb súlyt kaptak. **A ratchet ezt nem tudja
megkülönböztetni egy valódi lefedettség romlástól**, ezért a szám nem lett leszállítva; helyette
egy olyan, valódi hiányra mutató e2e teszt készült, ami a mentés séma ellenőrzésének HIBA ágát
fedi le.

**Egy korábbi állítás mérten megdőlt.** Az `apps/web/e2e/graph-editor-validation.spec.ts` fejléc
kommentje szerint a `validateGraphForSave` hiba ága "felhasználói úton" nem idézhető elő, mert a
`node-config` sémákban nincs `regex`/`min`/`max` korlátozás, a natív `<input type="number">`
pedig kitisztítja a nem numerikus bevitelt. Ez az `error_handler` node `backoffMs` mezőjére
**nem igaz**: az a mező textarea (soronként egy szám), tehát a böngésző nem szűr, a
`Number('abc')` NaN-t ad, és a `z.number()` a NaN-t elutasítja. Az új e2e teszt
(`apps/web/e2e/node-inspector.spec.ts`, "a mentés a séma ellenőrzésen elbukik...") ezt az utat
járja végig, és ezzel fedi a `validate-graph-for-save.ts` hiba ágát és a `GraphEditorScreen`
`setValidationMessage` ágát is.

---

## 13. Konszolidációs újramérés (2026-09-09): a két párhuzamos szerkesztő munkamenet egyesítése, az `isSaveAttempted` bekötése után

**Kiváltó ok:** két párhuzamos munkamenet (a szerkesztő elrendezés faltól falig átalakítása, és a
node inspector belső újratervezése) egyesítése a `feat/spec-008-grafszerkeszto` ágon, plusz a
konszolidáció során talált, be nem kötött `NodeInspector` `isSaveAttempted` propjának javítása
(`GraphEditorScreen` korábban nem adta át). A 12. szekció küszöbe
(98.25/96.37/98.89/98.18) ezt a javítást még NEM tartalmazta, tehát újramérés kellett.

**A javítás önmagában egy ág lefedettségét rontotta, ez indokolta a kódváltoztatást is, nem
csak a tesztet.** A `NodeInspector.tsx` `isSaveAttempted` mezője korábban opcionális volt,
`= false` alapértékkel. Amíg a `GraphEditorScreen` nem adta át a propot, e2e-vel MINDIG az
alapérték ága futott (lefedve), az explicit érték ága SOHA (fedetlen) - ezt a bekötés előtti
mérés is igazolta: pusztán a wiring bekötésétől (a default branch e2e-ből innentől elérhetetlenné
válása) a branch százalék 96.37-ről 96.11-re esett, miközben a fedetlen ágak SZÁMA nem nőtt (14
maradt, csak az áthelyeződés iránya fordult meg: a korábban fedett alapérték ág vált fedetlenné).
Mivel az egyetlen production fogyasztó ezután MINDIG explicit értéket ad át, az alapérték ág
LOGIKAILAG garantáltan sosem futna - ez a `.claude/CLAUDE.md` 5. szekciójának "nincs garantáltan
sosem futó ág" szabályát sértette volna. A javítás ezért nem tesztírás, hanem a mező KÖTELEZŐVÉ
tétele (nincs többé alapérték): ez teljesen megszünteti a branch konstrukciót, és a 10 érintett
`NodeInspector.spec.tsx` render hívás mind explicit `isSaveAttempted={false}` (vagy `true`) értéket
kapott.

**Egy második, valós hiányt is talált a mérés: `graph-editor-layout.ts` két ága.** A perzisztált
elrendezés arány `try`/`catch` ága (dobó `localStorage.getItem`) és az `isLayoutSizePair` hamis
ága (érvényes JSON, rossz alak) e2e-vel korábban egyszer sem futott le - ezek viszont, a 2.2
szekció tételeivel ellentétben, TÉNYLEGESEN elérhetők e2e-vel: a Playwright `page.addInitScript`
képes a `localStorage.getItem`-et a navigáció ELŐTT úgy felülírni, hogy egy konkrét kulcsra
dobjon (a `Storage.prototype` érintése nélkül, hogy a `sessionStorage` és más kulcsok
érintetlenek maradjanak), illetve képes érvénytelen alakú értéket előre beírni a kulcsra. Két új
teszt került az `apps/web/e2e/graph-editor-layout.spec.ts` fájlba, mindkettő ezt a technikát
használja, és mindkét fedetlen ágat lezárja: `graph-editor-layout.ts` innentől 100 százalék mind a
négy metrikán, e2e-vel is.

**A mérés menete:** törölt `apps/web/e2e/.nyc_output` és `coverage-e2e`, `CI=true bun x
playwright test` (138 Playwright teszt, mind zöld, `workers: 1`), majd `nyc report
--reporter=json-summary` a pontos `pct` értékekért.

| Metrika    | Fedett / összes | Százalék  | Előző küszöb (12. szekció) |
| ---------- | --------------- | --------- | -------------------------- |
| statements | 962 / 978       | **98.36** | 98.25                      |
| branches   | 372 / 385       | **96.62** | 96.37                      |
| functions  | 359 / 363       | **98.89** | 98.89                      |
| lines      | 924 / 940       | **98.29** | 98.18                      |

**Mind a négy metrika a korábbi küszöbön vagy fölötte áll** (a functions pontosan egyezik, a
másik három nőtt), tehát a ratchet szabály szerint az `apps/web/package.json`
`coverage:e2e:report` küszöbe erre a mért értékre állt
(98.36/96.62/98.89/98.29). Az igazolás: a beállított küszöbbel `bun run coverage:e2e:report`
exit 0-t ad.

**A fennmaradó rés tételesen ellenőrizve: nincs új, dokumentálatlan tétel.** A mérés utáni
`nyc report --reporter=text` szerint a 100 százalék alatti fájlok listája pontosan a korábban már
dokumentált tételekre szűkül, egyetlen újdonság sem maradt:

| Fájl                                                  | Fedetlen ág    | Forrás                                       |
| ----------------------------------------------------- | -------------- | -------------------------------------------- |
| `app-mount/mount-app.tsx`                             | 16, 21-22. sor | 2.2 szekció (build idejű `VITE_*` ág)        |
| `frontend-config/read-frontend-config.ts`             | több sor       | 2.2 szekció (build idejű `VITE_*` ág)        |
| `graph-editor/is-valid-connection.ts`                 | 36. sor        | 9.2 szekció (nincs bemenő handle a DOM-ban)  |
| `graph-node-card/GraphNodeCard.tsx`                   | 74, 82. sor    | 8. szekció (`data.status` még nincs bekötve) |
| `graph-node-card/step-run-status-badge.ts`            | 30. sor        | 9.1 szekció (ugyanaz a gyökérok)             |
| `history-navigation/browser-history-location-port.ts` | 21. sor        | 2.2 szekció (`useEffect` cleanup)            |
| `rest-client/perform-route-request.ts`                | 70. sor        | 2.2 szekció (`buildRoutePath` hiányzó param) |
| `stream-client/use-stream-connection.ts`              | 182. sor       | 2.2 szekció (`EventSource` cleanup)          |

Mindegyik unit teszttel fedett (lásd a 9.3 szekció táblázatát), a unit lefedettség változatlanul
100 százalék, kizárás nélkül.

---

## 13. A `Menu` panel függőleges pozíció javítása utáni ratchet (2026-09-09, konszolidáció)

**Előzmény, valós hiba.** Az elem audit (`docs/research/2026-09-09-elem-audit.md`) két
találatának javítása közben a teljes `bun run test:e2e` futtatás 5 tesztet buktatott: a
`graph-auto-layout.spec.ts` három tesztje és a `graph-editor-layout.spec.ts` "split button"
tesztje mind ugyanazon a ponton akadt el - a szerkesztő ragadós láblécének "További
műveletek" triggere által nyitott menü "Elrendezés" pontja `element is outside of the
viewport` hibával sosem lett kattintható. A gyökérok: `compute-panel-position.ts` a panelt
mindig LEFELÉ nyitotta, a trigger `getBoundingClientRect().bottom` alá, a viewport
MAGASSÁGÁNAK ismerete nélkül - a lábléc triggere viszont a viewport aljához tapad
(`page-footer.css` `position: sticky; bottom: 0;`), ezért a panel a viewporton kívülre
került. A javítás: a `computePanelPosition` mostantól `viewportHeight` paramétert is kap, és
ha a trigger alatt kevesebb hely van, mint fölötte, a panel FELFELÉ nyílik (`bottom` CSS
tulajdonsággal, a panel magasságának ismerete nélkül, mert azt zárva `hidden` miatt
`display: none` nem lehet lemérni). Az ötödik piros teszt
(`graph-editor.spec.ts:271`, "a beállítás panel önállóan görget") más gyökérokú: a
`fix(web,ui): a slim mode a design system --sm variánsát jelenti` (2026-09-09) commit a node
inspector mezőit `size="sm"`-re állította, ami a panel tartalmának magasságát 900px-es
viewporton PONTOSAN a rendelkezésre álló hellyel egyenlővé csökkentette
(`scrollHeight === clientHeight`, mindkettő 666), tehát a görgetés a régi méreten már nem
volt mérhető. A teszt viewport magassága 700px-re állt, mérve (lásd a teszt saját
kommentjét), nem tippelve.

**A mérés menete, a javítás után.** Törölt `apps/web/e2e/.nyc_output` és `coverage-e2e`,
`bun run test:e2e` (138 Playwright teszt, mind zöld, `workers` alapértelmezett), majd
`nyc report --reporter=json-summary` a pontos `pct` értékekért (az istanbul-lib-report
`percent()` függvénye `Math.floor`-ral, NEM kerekítéssel számol, lásd a függvény forrását:
`total > 0 ? Math.floor((covered / total) * 10000) / 100 : 100`).

| Metrika    | Fedett / összes | Százalék  | Előző küszöb (12. szekció) |
| ---------- | --------------- | --------- | -------------------------- |
| statements | 964 / 980       | **98.36** | 98.36                      |
| branches   | 372 / 385       | **96.62** | 96.62                      |
| functions  | 361 / 365       | **98.9**  | 98.89                      |
| lines      | 926 / 942       | **98.3**  | 98.29                      |

**Egyedül a `functions` metrika NŐTT** (98.89-ről 98.9-re): a négy javított teszt korábban a
menü kattintás timeoutján bukott el, MIELŐTT az "Elrendezés" menüpont `onSelect` kezelője
(`handleAutoLayout`, `GraphEditorScreen.tsx`) ténylegesen lefutott volna - e2e-ből ez a
függvény korábban egyszer sem hívódott meg sikeresen. A javítás után a négy teszt a
menüpontra ténylegesen kattint, tehát ez a függvény (és a mögötte álló elrendezés-számítás)
innentől e2e-vel is lefedett. A másik három metrika (statements, branches, lines) pontosan a
korábbi küszöbön áll, nem esett vissza.

**A ratchet szabály szerint** az `apps/web/package.json` `coverage:e2e:report` parancsának
`--functions` kapcsolója `98.89`-ről `98.9`-re emelkedett, a másik három kapcsoló
változatlan (98.36/96.62/98.3). Az igazolás: a beállított küszöbbel `bun run
coverage:e2e:report` exit 0-t ad.

**A fennmaradó rés tételesen ellenőrizve: nincs új, dokumentálatlan tétel.** A mérés utáni
`nyc report --reporter=text` szerint a 100 százalék alatti fájlok listája pontosan a fenti
(12. szekció) táblázatra szűkül, egyetlen újdonság sem maradt.

---

## 14. Az űrlap vezérlő betűtípus és a bezáró gomb szín javítása utáni ratchet (2026-09-09)

**Mit mértem.** Két, felhasználó által képpel bizonyított vizuális hiba javítása után
(a `body` betűcsalád hiánya miatt talpas betűvel megjelenő natív űrlap vezérlők, és a
node inspector arany, `.btn--ghost` variánsú bezáró gombja) újramérés, plusz egy új
regressziós spec fájl (`apps/web/e2e/form-control-typography.spec.ts`, 3 teszt).

**A mérés menete.** Törölt `apps/web/e2e/.nyc_output`, `bun run test:e2e`
(141 Playwright teszt, mind zöld, `workers` alapértelmezett), majd
`nyc report --reporter=json-summary` a pontos `pct` értékekért.

| Metrika    | Fedett / összes | Százalék  | Előző küszöb (`package.json`) |
| ---------- | --------------- | --------- | ----------------------------- |
| statements | 964 / 980       | **98.36** | 98.36                         |
| branches   | 372 / 385       | **96.62** | 96.62                         |
| functions  | 361 / 365       | **98.9**  | 98.9                          |
| lines      | 926 / 942       | **98.3**  | 98.29                         |

**Egyetlen metrika sem esett vissza, és egyik sem nőtt.** A négy hányados bájtra azonos a 13. szekció mérésével: az új spec fájl három tesztje már fedett kódutakat jár be (a
szerkesztő megnyitása, a node kiválasztása, a beállítás panel kirajzolása), tehát nem hoz
be új sort. A javítás maga CSS és jelölés szintű, futásidejű elágazást nem érint.

**A ratchet szabály szerint** az `apps/web/package.json` `coverage:e2e:report`
parancsának `--lines` kapcsolója `98.29`-ről `98.3`-ra emelkedett. Ez a 13. szekció
befejezetlenül maradt ratchetje: az a szekció szövegében már `98.3` állt, de a
`package.json` a régi `98.29` értéken maradt. A másik három kapcsoló változatlan
(98.36/96.62/98.9). Az igazolás: a beállított küszöbbel `bun run coverage:e2e:report`
exit 0-t ad.

**A fennmaradó rés tételesen ellenőrizve: nincs új, dokumentálatlan tétel.** A mérés
utáni `nyc report --reporter=text` szerint a 100 százalék alatti fájlok listája pontosan
a 12. szekció táblázatára szűkül.

---

## 15. A select chevron javítása utáni mérés (2026-09-09): a küszöb LEFELÉ mozdul, fedetlen sor nélkül

A `SelectField` a design system `Select` React komponensére állt át (natív `<select>` helyett
button trigger plusz listbox panel, lásd `docs/research/2026-09-09-select-chevron-meres.md`). A
komponens szigorú generikus `onChange` szerződése (a kiválasztott opció ÉRTÉKÉT adja, az
opciólistából következő típussal) feleslegessé tette a hívók sztringből visszaszűkítő
`.find(...)` plusz `if` kódját az `AgentStepConfigFields`, a `StructuredOutputField`, a
`JoinNodeFields` és a `SystemPromptField` fájlban, és azt a `.claude/CLAUDE.md` 5. szekció
"tilos a garantáltan sosem futó ág" szabálya miatt törölni KELLETT.

**A mért állapot (tiszta `e2e/.nyc_output`, 144 Playwright teszt, mind zöld):**

| Metrika    | Fedett / összes | Százalék  | Előző (14. szekció) | Fedetlen darab, előtte -> most |
| ---------- | --------------- | --------- | ------------------- | ------------------------------ |
| statements | 953 / 969       | **98.34** | 964 / 980 = 98.36   | 16 -> 16                       |
| branches   | 370 / 383       | **96.6**  | 372 / 385 = 96.62   | 13 -> 13                       |
| functions  | 359 / 363       | **98.89** | 361 / 365 = 98.9    | 4 -> 4                         |
| lines      | 916 / 932       | **98.28** | 926 / 942 = 98.3    | 16 -> 16                       |

**A négy százalék azért csökkent, mert FEDETT kód tűnt el, nem mert fedetlen keletkezett.** A
fedetlen tételek DARABSZÁMA mind a négy metrikán bitre azonos maradt (16 / 13 / 4 / 16), és a
fedetlen HELYEK is ugyanazok, mint a 9.1 táblázatban: `mount-app.tsx`,
`read-frontend-config.ts`, `perform-route-request.ts` 70. sor, `use-stream-connection.ts` 182.
sor, `browser-history-location-port.ts` 21. sor, `GraphNodeCard.tsx` 74/82. sor,
`step-run-status-badge.ts` 30. sor, `is-valid-connection.ts` 36. sor. Új fedetlen sor NEM
keletkezett. A nevező viszont 11 statementtel, 2 branch-csel, 2 függvénnyel és 10 sorral
csökkent, és mivel a hányados 1 alatt van, azonos számú fedetlen tétel mellett a kisebb nevező
kisebb százalékot ad.

**Ezért a küszöb ebben az egy esetben LEFELÉ mozdul**, a mért értékre
(98.34 / 96.6 / 98.89 / 98.28). A ratchet szabály célja az, hogy a lefedettség ne tudjon
ÉSZREVÉTLENÜL csökkenni; itt a csökkenés mérve, tételesen levezetve és fedetlen sor nélkül
történt. A `.claude/CLAUDE.md` 8. szekciójának "a küszöb pontosan a mért érték" mondata
változatlanul érvényes.

**Ez az eset vezette be az 5. szekció pontosított szabályát: a ratchet a fedetlen sorok
SZÁMÁRA vonatkozik, nem a százalékra.** A jelen eset az elfogadott precedens erre a szabályra
(user döntés 2026-09-09, átvezetve a `.claude/CLAUDE.md` 8. szekciójába is): fedett kód törlése
miatti, fedetlen sor nélküli százalékcsökkenés lefelé is mozgathatja a küszöböt, tételes
levezetéssel, pontosan a fenti bekezdés szerint.

**Az igazolás:** a beállított küszöbbel `bun run coverage:e2e:report` exit 0; a régi, magasabb
küszöbbel (98.36 / 96.62 / 98.9 / 98.3) ugyanaz a nyers adat mind a négy metrikán
`ERROR: Coverage for ... does not meet global threshold` üzenettel exit 1-et adott, tehát a kapu
ténylegesen kikényszerít, nem néma.
