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
