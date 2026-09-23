# Teszt időkorlát bombák: mérés és javítás (2026-09-23)

Kiváltó esemény: a `feat/spec-008-futas-nezet` ág `d6e3be7` commitján a CI Test jobja elbukott,
mert a `tooling/scripts/src/casing/check-casing.spec.ts` 5019 ms alatt futott le, a Vitest
alapértelmezett 5000 ms-os teszt időkorlátja fölött. Az előző zöld futásokban ugyanez a teszt
4976 és 4996 ms volt (fájl szinten 4979 és 4999 ms), tehát eddig is a határon állt. Helyben a
teljes `bun run test` az `apps/web/src/app-mount/main.spec.ts` tesztnél bukott ugyanígy.

A fájl megméri, mi viszi el az időt, dokumentálja a javítást, és felsorolja a korlát közelében
álló többi tesztet.

## 1. Források és környezet

| Tétel                             | Érték és forrás                                                                                                                                                                                                                                                                          |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vitest, coverage provider         | `vitest@4.1.11`, `@vitest/coverage-v8@4.1.11` (a telepített fa)                                                                                                                                                                                                                          |
| Teszt időkorlát alapértéke        | 5000 ms: a telepített forrás `resolved.testTimeout ??= resolved.browser.enabled ? 15e3 : 5e3` (`vitest/dist/chunks/coverage.DM_a_rWm.js`), és a hivatalos doksi: <https://vitest.dev/config/testtimeout> ("Default: `5_000` in Node.js")                                                 |
| A gyűjtési fázis nem időkorlátos  | a telepített `@vitest/runner` `collectTests` függvénye a tesztfájlt `await runner.importFile(filepath, "collect")` hívással tölti be, `withTimeout` nélkül; a `withTimeout` csak a teszt és a hook futtatását burkolja (`@vitest/runner/dist/chunk-artifact.js`)                         |
| A coverage műszerezés módja       | a telepített `@vitest/coverage-v8/dist/index.js` minden workerben `Profiler.startPreciseCoverage({ callCount: true, detailed: true })` hívást tesz, és a `node_modules` bejegyzéseket csak a GYŰJTÉS UTÁN szűri ki (`filterResult`), tehát a `typescript` csomag kódja is műszerezve fut |
| A precíz coverage költsége        | V8 blog, <https://v8.dev/blog/javascript-code-coverage>: a precíz mód "performance might be impacted by increased overhead", a blokk szintű mód a blokkokba `IncBlockCounter` bájtkódot told. A konkrét lassulást a lenti saját mérés adja, nem ez a forrás                              |
| Sharding és jelentés összefésülés | <https://v4.vitest.dev/guide/improving-performance#sharding> (`--shard`, `--reporter=blob`, `--merge-reports`), a lenti helyi mérések ezt használják                                                                                                                                     |
| Helyi környezet                   | a fejlesztői sandbox: aarch64 Linux, 4 CPU, 3 GB RAM, Node 26.7.0; a repó egy gazdagépről megosztott mounton áll, ahol a fájlolvasás lassú (lásd 3.1)                                                                                                                                    |
| CI környezet                      | GitHub Actions `ubuntu-latest` (a napló szerint `ubuntu-24.04` image), `bun run test`                                                                                                                                                                                                    |

## 2. A két teszt és a hasonlóan felépített harmadik

- `tooling/scripts/src/casing/check-casing.spec.ts`: a `findCasingMismatches` a `git ls-files`
  minden `.ts/.tsx/.js/.jsx/.mjs/.cjs` fájlját beolvassa, és mindegyikre teljes TypeScript AST-t
  épít (`createSourceFile`, `setParentNodes: true`). Mérve 1298 fájl, 4,5 MB forrás.
- `tooling/scripts/src/relative-import-extension/relative-import-extension.spec.ts`: ugyanezt a
  kinyerőt hívja a `packages/*/src` és az `apps/*/src` fájljaira. Ez a harmadik, a CI-ban 2895 és
  4331 ms között mért teszt, a második legveszélyesebb.
- `apps/web/src/app-mount/main.spec.ts`: a teszt törzsében `await import('./main.tsx')` áll, ami
  a teljes alkalmazás modulgráfját (`AppShell`, minden képernyő) a teszt időkorlátján belül
  transzformálja és értékeli ki.

## 3. A gyökérok mérése

### 3.1 `check-casing.spec.ts` és `relative-import-extension.spec.ts`

Szétbontás egy ideiglenes, mérés után törölt `.spec.ts` fájlban, ugyanazon a 1298 fájlon, a
teszttel azonos Vitest workerben (ms, két egymás utáni futás):

| Lépés                                          | coverage nélkül | `--coverage` (V8) mellett |
| ---------------------------------------------- | --------------- | ------------------------- |
| `git ls-files`                                 | 6-8             | 6-8                       |
| 1298 fájl `readFileSync` (helyi mount)         | 567-611         | 619-834                   |
| `createSourceFile`, `setParentNodes: true`     | 342, 226        | 1405, 1289                |
| `createSourceFile`, `setParentNodes: false`    | 157, 150        | 1056, 1063                |
| ugyanez, `jsDocParsingMode: ParseNone` mellett | 139, 137        | 985, 980                  |
| `preProcessFile` (heurisztikus szkenner)       | 87, 53          | 460, 434                  |

**Gyökérok:** a teszt a teljes repó minden forrásfájlját TypeScript parserrel dolgozza fel, és a
`bun run test` V8 coverage alatt fut, ami a `typescript` csomag kódját is műszerezi (1. szekció).
A parse így 4,1-5,7-szeresére lassul (342 -> 1405 ms hidegen, 226 -> 1289 ms melegen), a költség
pedig a repó méretével arányosan nő: a CI-ban ugyanez a teszt 2026-09-22-én még 3221 ms, egy nappal
később már 4976-5019 ms volt. A `tooling/**` a coverage riportból ki van zárva, tehát a
műszerezés itt semmit nem mér, csak lassít.

A parser beállításai (`setParentNodes`, `jsDocParsingMode`) legfeljebb 1,4-szeres gyorsulást
adnak coverage alatt, a `preProcessFile` 3-szorosat, de az utóbbi heurisztikus (nem kezeli
újraszkenneléssel a regex literált), tehát nem ugyanazt az invariánst őrizné. Egyik sem a
gyökérokot szünteti meg.

### 3.2 `apps/web/src/app-mount/main.spec.ts`

Egyedül futtatva, coverage nélkül a teszt törzse 2218-2300 ms (három futás). Ugyanez a teszt egy
statikus, előtöltő `import './mount-app.tsx'` sorral 29-30 ms, a Vitest összegzője szerint a
gyűjtési fázis ("import") 1,83 s-ot vett át.

**Gyökérok:** a teszt törzsében álló dinamikus `import('./main.tsx')` a teljes alkalmazás
modulgráfjának transzformálását és kiértékelését a teszt időkorlátjába számítja, holott a teszt
tárgya csak a `main.tsx` két sora. Terhelés alatt (a teljes suite a helyi 4 CPU-n) ez 3367-3638
ms-ra nőtt.

## 4. A javítás

### 4.1 Előszűrő a TypeScript parse elé

Új fájl: `tooling/scripts/src/casing/find-relative-specifier-candidates.ts`. Szövegkereséssel
gyűjti a `'./`, `'../`, `"./`, `"../` kezdetű jelölteket, mindkét idézőjel MINDEN előfordulását
külön vizsgálva, és `undefined`-ot ad, ha egy jelölt nyers alakja eltérhet a feldolgozott
értékétől (visszaperjel a jelölt elején vagy belsejében, `\n` vagy `\r`, lezáratlan idézőjel).
A TypeScript 6 szkennere (`scanString`) pontosan a visszaperjelnél és a `\n`/`\r` karakternél
tér el a nyers szövegtől, ezt a telepített `typescript.js` forrásán ellenőriztük.

A `findCasingMismatches` és a `relative-import-extension.spec.ts` a teljes parse-ot csak akkor
futtatja egy fájlra, ha az előszűrő `undefined`-ot ad, vagy legalább egy jelöltje a saját
szabályuk szerint gyanús. Minden más fájl eredménye a garancia miatt üres. Az eredmény tehát
fájlonként megegyezik a korábbival, a parse viszont a 1298 fájl helyett 32-re fut.

Empirikus ellenőrzés a teljes repón (2026-09-23): 1298 fájl, 32 fájlra `undefined`, a többi 1266
fájl 3101 pontos (parser szerinti) specifikátorából **0 hiányzik** a jelöltek közül.

Az előszűrés utáni szétbontás coverage alatt: `git ls-files` 8, olvasás 834, jelöltkeresés 8,
32 fájl parse-a 113 ms. A parse költsége tehát 1405 ms-ról 113 ms-ra esett, a helyi futásidő
maradékát a mount lassú fájlolvasása adja, ami a CI natív fájlrendszerén nincs jelen.

### 4.2 Előtöltő import a `main.spec.ts`-ben

`import './mount-app.tsx';` a fájl tetején: a modulgráf a gyűjtési fázisban töltődik be, amire a
Vitest nem alkalmaz időkorlátot (1. szekció). A teszt törzsében maradó `import('./main.tsx')`
ugyanazt a `mountApp` példányt kapja, és csak a `main.tsx` mellékhatását futtatja. A `main.tsx`
nem változott, tehát a `greppable-invariants.spec.ts` sorra rögzített alakja is érvényes marad.

## 5. Előtte és utána (ms)

Helyi, egyedül futtatva, `--coverage` mellett:

| Teszt                               | előtte     | utána |
| ----------------------------------- | ---------- | ----- |
| `check-casing.spec.ts`              | 2696, 2687 | 1498  |
| `relative-import-extension.spec.ts` | nem mért   | 1417  |
| `app-mount/main.spec.ts`            | 2671, 2726 | 35    |

Helyi, a teljes suite-tal együtt, `--coverage` mellett (terhelés alatt). "E" = egyben futtatott
teljes suite, "S" = négy shardra bontott teljes suite (a sandbox parancs időkorlátja miatt, 8.
szekció):

| Teszt                               | előtte E1 | előtte E2 | előtte S1 | utána S1 | utána S2 | utána S3 |
| ----------------------------------- | --------- | --------- | --------- | -------- | -------- | -------- |
| `check-casing.spec.ts`              | 3071      | 3024      | 3018      | 2022     | 1440     | 1466     |
| `relative-import-extension.spec.ts` | 2760      | 2648      | 2724      | 1472     | 1390     | 1321     |
| `app-mount/main.spec.ts`            | 3638      | 3367      | 2463      | 43       | 40       | 36       |

A helyi "utána" idő nagyobbik része a megosztott mount fájlolvasása (4.1 szétbontás), ami a CI
natív fájlrendszerén nincs jelen; a CI számok ezt mutatják.

CI, a Test job naplójából, teszt szinten (run azonosító). Az `app-mount/main.spec.ts` a javítás
után 300 ms alá esett, ezért a CI napló (Vitest `slowTestThreshold` alapértéke 300 ms, telepített
`vitest/dist/chunks/defaults.9aQKnqFk.js`) a teszt szintű idejét nem írja ki, csak a fájl szintűt;
az utóbbi a teszt idejének felső korlátja:

| Teszt                               | 35796717087 | 35802378720 | 35808999237 | 35813724443   | utána: 35820006956 | utána: ugyanaz, 2. kísérlet |
| ----------------------------------- | ----------- | ----------- | ----------- | ------------- | ------------------ | --------------------------- |
| `check-casing.spec.ts`              | 3221        | 4976        | 4996        | 5019 (bukott) | 522                | 529                         |
| `relative-import-extension.spec.ts` | 2895        | 4281        | 4331        | 3972          | 335                | 352                         |
| `app-mount/main.spec.ts`            | 442         | 609         | 571         | 635           | fájl szinten 93    | fájl szinten 87             |

## 6. A szándékos rontás igazolása

Mindhárom rontás ideiglenes volt, a futás után visszaállítva.

1. **Betűzés, két fájlban egyszerre.** A `tooling/scripts/src/casing/check-casing.ts` importja
   `./Find-casing-mismatches.ts`-re, az `apps/web/src/run-event-row/run-event-row-summary.spec.ts`
   importja `./Run-event-row-summary.ts`-re írva. Az utóbbi szándékosan olyan fájl, amire az
   előszűrő `undefined`-ot ad (visszaperjeles sztring van benne), tehát a pontos parse ágán fut. A
   `check-casing.spec.ts` bukott, és pontosan ezt a két eltérést listázta; a `bun run
check:casing` kapu `1` kilépési kóddal állt meg.
2. **Kiterjesztés, két fájlban egyszerre.** Az `apps/web/src/app-mount/mount-app.tsx`
   `../app-shell/app-shell.tsx` importja és a fenti `run-event-row-summary.spec.ts` importja
   kiterjesztés nélkül. A `relative-import-extension.spec.ts` bukott, és pontosan ezt a két
   specifikátort listázta.
3. **Belépési pont.** A `main.tsx` `mountApp();` sora kikommentelve: a `main.spec.ts` bukott
   (`expected '' to contain 'Új workflow'`), visszaállítás után zöld, 29 ms.

## 7. A korlát közeli tesztek

Küszöb: az 5000 ms-os korlát fele, 2500 ms. Mérve a teljes suite-tal együtt, `--coverage`
mellett, a javítás ELŐTT.

| Teszt                                                      | helyi (ms) | CI (ms)   | Állapot                                                 |
| ---------------------------------------------------------- | ---------- | --------- | ------------------------------------------------------- |
| `apps/web/src/app-mount/main.spec.ts`                      | 2463-3638  | 442-635   | javítva (4.2)                                           |
| `tooling/scripts/src/casing/check-casing.spec.ts`          | 3018-3071  | 3221-5019 | javítva (4.1)                                           |
| `apps/server/src/main.spec.ts`                             | 3024-3316  | 1033-1233 | **nem javítva**, a párhuzamos agent területe, lásd lent |
| `tooling/scripts/src/relative-import-extension/...spec.ts` | 2648-2760  | 2895-4331 | javítva (4.1)                                           |

Figyelőlista, 1000 és 2500 ms között (csak helyben, a CI-ban mindegyik 300 ms alatt maradt, tehát
a CI napló nem is írta ki a tesztenkénti idejüket): `screenshot-pipeline.spec.ts` (1) 1451-1797 és
(2) 1393-1676, `no-em-dash.spec.ts` 1226-1657. Mindhárom a teljes repó fájljait olvassa, a helyi
lassúságuk a mount fájlolvasásából jön.

**Az `apps/server/src/main.spec.ts`**, nem ellenőrzött feltevés: a teszt törzsében ugyanaz a minta
áll (`await import('./main.ts')`), mint a javítás előtti `apps/web` belépési pont tesztjében, tehát
valószínűleg ugyanaz a gyökérok. Mi zárná le: egy előtöltő import a `main.ts` saját moduljára és a
teszt törzsének újramérése. A javítás a párhuzamosan dolgozó agent területén van, ezért nem nyúltunk
hozzá.

## 8. Nyitott pontok

- A helyi `check-casing.spec.ts` idejének nagyobbik része a javítás után a fájlolvasás a megosztott
  mounton. Párhuzamos (`fs/promises`) olvasással mérni próbáltuk, de a sandbox fájlleíró korlátja
  (`EMFILE`) megakasztotta, és a CI-ban ez a költség nincs jelen, ezért nem építettük be.
- A teljes `bun run test` egyetlen hívásban helyben nem fut le: a sandbox parancs időkorlátja
  (mérve 121 és 178 s között változott) rövidebb a teljes suite coverage-dzsel együtt mért
  idejénél. A helyi igazolás ezért négy shardon és `--merge-reports --coverage` összefésüléssel
  ment (1. szekció, sharding doksi): az "utána S1", "S2" és "S3" futás összefésülve egyaránt 491
  tesztfájl, 3810 teszt, mind zöld, a lefedettség mind a négy metrikán 100 százalék.
